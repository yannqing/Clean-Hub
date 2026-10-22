import type { ResetTenantUserPasswordRequest } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";
import type { TenantUserActionResult } from "./create-tenant-user.action";

export async function resetTenantUserPasswordAction(
  userId: string,
  input: ResetTenantUserPasswordRequest,
): Promise<TenantUserActionResult> {
  try {
    await webAdminApi.tenant.users.resetPassword(userId, input);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to reset password.",
    };
  }
}
