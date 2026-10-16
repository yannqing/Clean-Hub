import type { DeleteTenantUserRequest } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";
import type { TenantUserActionResult } from "./create-tenant-user.action";

export async function deleteTenantUserAction(
  userId: string,
  input: DeleteTenantUserRequest,
): Promise<TenantUserActionResult<void>> {
  try {
    await webAdminApi.tenant.users.delete(userId, input);
    return { ok: true, data: undefined };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to delete employee.",
    };
  }
}
