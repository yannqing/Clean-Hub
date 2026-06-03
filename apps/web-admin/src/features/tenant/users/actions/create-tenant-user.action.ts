import { webAdminApi } from "@/lib/api-client";

import type { CreateTenantUserRequest, TenantUserSummary } from "../types";

export type CreateTenantUserActionResult =
  | { ok: true; data: TenantUserSummary }
  | { ok: false; error: string };

export async function createTenantUserAction(
  input: CreateTenantUserRequest,
): Promise<CreateTenantUserActionResult> {
  try {
    const user = await webAdminApi.tenant.users.create(input);
    return { ok: true, data: user };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to create user.",
    };
  }
}
