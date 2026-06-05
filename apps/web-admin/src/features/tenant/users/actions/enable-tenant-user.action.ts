import { webAdminApi } from "@/lib/api-client";

export type EnableTenantUserActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function enableTenantUserAction(
  userId: string,
): Promise<EnableTenantUserActionResult> {
  try {
    await webAdminApi.tenant.users.enable(userId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to enable user.",
    };
  }
}
