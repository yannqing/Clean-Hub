import { webAdminApi } from "@/lib/api-client";

export type DisableTenantUserActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function disableTenantUserAction(
  userId: string,
): Promise<DisableTenantUserActionResult> {
  try {
    await webAdminApi.tenant.users.disable(userId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to disable user.",
    };
  }
}
