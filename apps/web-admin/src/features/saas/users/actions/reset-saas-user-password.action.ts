import { webAdminApi } from "@/lib/api-client";

import type { ResetSaasUserPasswordResult } from "../types";

const MAX_REASON_LENGTH = 500;

export type ResetSaasUserPasswordActionResult =
  | { ok: true; data: ResetSaasUserPasswordResult }
  | { ok: false; errors: { reason?: string } };

export async function resetSaasUserPasswordAction(
  userId: string,
  reason: string,
): Promise<ResetSaasUserPasswordActionResult> {
  const trimmedReason = reason.trim();

  if (!trimmedReason) {
    return {
      ok: false as const,
      errors: { reason: "Reason is required." },
    };
  }

  if (trimmedReason.length > MAX_REASON_LENGTH) {
    return {
      ok: false as const,
      errors: {
        reason: `Reason must be ${MAX_REASON_LENGTH} characters or fewer.`,
      },
    };
  }

  try {
    const result = await webAdminApi.saas.users.resetPassword(userId, {
      reason: trimmedReason,
    });
    return { ok: true as const, data: result };
  } catch (error) {
    return {
      ok: false as const,
      errors: {
        reason:
          error instanceof Error
            ? error.message
            : "Failed to reset SaaS user password.",
      },
    };
  }
}
