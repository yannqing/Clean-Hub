import {
  ApiNetworkError,
  ApiTimeoutError,
  isApiHttpError,
} from "@cleanhub/api-client";
import { getMobileSession } from "@/lib/token-storage";
import { createDeliveryStorage } from "@/features/delivery/lib/storage";

export async function cachedCustomerQuery<T extends object>(
  resource: string,
  network: () => Promise<T>,
): Promise<T & { cachedAt?: string }> {
  const session = await getMobileSession();
  if (!session || session.authContext.role !== "customer") return network();
  const scope = `${session.authContext.tenantId}:${session.authContext.subjectId}`;
  const key = `cleanhub.mobile.customer.v1:${scope}:${resource}`;
  const storage = createDeliveryStorage();
  try {
    const value = await network();
    const current = await getMobileSession();
    if (
      current &&
      `${current.authContext.tenantId}:${current.authContext.subjectId}` ===
        scope
    ) {
      // Cache failure must not turn a successful business read into a failure.
      await storage
        .setItem(
          key,
          JSON.stringify({ loadedAt: new Date().toISOString(), value }),
        )
        .catch(() => undefined);
    }
    return value;
  } catch (error) {
    if (
      !(
        error instanceof ApiNetworkError ||
        error instanceof ApiTimeoutError ||
        (isApiHttpError(error) && error.status >= 500)
      )
    )
      throw error;
    const current = await getMobileSession();
    if (
      !current ||
      `${current.authContext.tenantId}:${current.authContext.subjectId}` !==
        scope
    )
      throw error;
    try {
      const raw = await storage.getItem(key);
      if (raw) {
        const cached = JSON.parse(raw) as { loadedAt?: string; value?: T };
        if (
          cached.value &&
          typeof cached.loadedAt === "string" &&
          Number.isFinite(Date.parse(cached.loadedAt))
        )
          return { ...cached.value, cachedAt: cached.loadedAt };
      }
    } catch {
      /* Invalid cache is never treated as a successful empty response. */
    }
    throw error;
  }
}
