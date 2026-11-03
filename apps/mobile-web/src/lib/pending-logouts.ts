import { isApiHttpError } from "@cleanhub/api-client";
import { apiClient } from "./api-client";
import { createDeliveryStorage } from "@/features/delivery/lib/storage";
import type { StoredMobileSession } from "./token-storage";

const key = "cleanhub.mobile.pending-logouts.v1";
type PendingLogout = {
  refreshToken: string;
  deviceId: string;
  expiresAt: string;
};
let mutation: Promise<unknown> = Promise.resolve();
let replaying: Promise<void> | null = null;

function serialize<T>(action: () => Promise<T>): Promise<T> {
  const result = mutation.then(action, action);
  mutation = result.catch(() => undefined);
  return result;
}
async function read(): Promise<PendingLogout[]> {
  const raw = await createDeliveryStorage().getItem(key);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  return Array.isArray(parsed)
    ? parsed.filter((job): job is PendingLogout =>
        Boolean(
          job &&
          typeof job.refreshToken === "string" &&
          typeof job.deviceId === "string" &&
          typeof job.expiresAt === "string" &&
          Date.parse(job.expiresAt) > Date.now(),
        ),
      )
    : [];
}
async function write(jobs: PendingLogout[]) {
  const storage = createDeliveryStorage();
  if (jobs.length) await storage.setItem(key, JSON.stringify(jobs));
  else await storage.removeItem(key);
}

/** Revocation jobs are never read as login credentials and expire with the token. */
export function rememberPendingLogout(
  session: StoredMobileSession,
  deviceId: string,
) {
  return serialize(async () => {
    const jobs = await read();
    if (!jobs.some((job) => job.refreshToken === session.refreshToken))
      jobs.push({
        refreshToken: session.refreshToken,
        deviceId,
        expiresAt: session.refreshTokenExpiresAt,
      });
    await write(jobs);
  });
}

export function replayPendingLogouts(): Promise<void> {
  if (replaying) return replaying;
  replaying = (async () => {
    const jobs = await serialize(async () => {
      const jobs = await read();
      await write(jobs);
      return jobs;
    });
    for (const job of jobs) {
      try {
        await apiClient.mobile.auth.logout(
          { refreshToken: job.refreshToken, deviceId: job.deviceId },
          { skipAuthRefresh: true, timeoutMs: 5000 },
        );
      } catch (error) {
        if (!(isApiHttpError(error) && [401, 403, 422].includes(error.status)))
          break;
      }
      await serialize(async () =>
        write(
          (await read()).filter(
            (current) => current.refreshToken !== job.refreshToken,
          ),
        ),
      );
    }
  })()
    .catch(() => undefined)
    .finally(() => {
      replaying = null;
    });
  return replaying;
}
