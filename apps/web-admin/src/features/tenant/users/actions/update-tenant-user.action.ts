"use server";

import { webAdminApi } from "@/lib/api-client";

import type { TenantUserDetail, UpdateTenantUserRequest } from "../types";

export type UpdateTenantUserActionResult =
  | { ok: true; data: TenantUserDetail }
  | { ok: false; error: string };

export async function updateTenantUserAction(
  userId: string,
  input: UpdateTenantUserRequest,
): Promise<UpdateTenantUserActionResult> {
  try {
    const user = await webAdminApi.tenant.users.update(userId, input);
    return { ok: true, data: user };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to update user.",
    };
  }
}
