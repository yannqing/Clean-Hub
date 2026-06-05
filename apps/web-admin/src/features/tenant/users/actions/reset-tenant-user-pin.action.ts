import { webAdminApi } from "@/lib/api-client";

import type { ResetTenantUserPinResult } from "../types";

export type ResetTenantUserPinActionResult =
  | { ok: true; data: ResetTenantUserPinResult }
  | { ok: false; error: string };

export async function resetTenantUserPinAction(
  userId: string,
  reason: string,
): Promise<ResetTenantUserPinActionResult> {
  try {
    const result = await webAdminApi.tenant.users.resetPin(userId, { reason });
    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to reset user PIN.",
    };
  }
}
