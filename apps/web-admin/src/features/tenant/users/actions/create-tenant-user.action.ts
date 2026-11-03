import type { CreateTenantUserRequest, TenantUserSummary } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

export type TenantUserActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createTenantUserAction(
  input: CreateTenantUserRequest,
): Promise<TenantUserActionResult<TenantUserSummary>> {
  try {
    return { ok: true, data: await webAdminApi.tenant.users.create(input) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to create user.",
    };
  }
}
