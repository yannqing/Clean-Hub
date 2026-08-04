import type { TenantUserDetail, UpdateTenantUserRequest } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";
import type { TenantUserActionResult } from "./create-tenant-user.action";

export async function updateTenantUserAction(
  userId: string,
  input: UpdateTenantUserRequest,
): Promise<TenantUserActionResult<TenantUserDetail>> {
  try {
    return {
      ok: true,
      data: await webAdminApi.tenant.users.update(userId, input),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to update user.",
    };
  }
}
