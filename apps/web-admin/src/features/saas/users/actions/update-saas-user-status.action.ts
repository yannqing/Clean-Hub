import { webAdminApi } from "@/lib/api-client";

import type { SaasUserDetail, UpdateSaasUserStatusRequest } from "../types";

const MAX_STATUS_REASON_LENGTH = 300;

export async function updateSaasUserStatusAction(
  userId: string,
  input: UpdateSaasUserStatusRequest,
) {
  if (input.status !== "active" && input.status !== "disabled") {
    return {
      ok: false as const,
      errors: {
        reason: "Only active and disabled status changes are supported.",
      },
    };
  }

  const reason = input.reason.trim();

  if (!reason) {
    return {
      ok: false as const,
      errors: {
        reason: "Reason is required.",
      },
    };
  }

  if (reason.length > MAX_STATUS_REASON_LENGTH) {
    return {
      ok: false as const,
      errors: {
        reason: `Reason must be ${MAX_STATUS_REASON_LENGTH} characters or fewer.`,
      },
    };
  }

  const user = await webAdminApi.http.patch<SaasUserDetail>(
    `/saas/users/${encodeURIComponent(userId)}/status`,
    {
      status: input.status,
      reason,
    },
  );

  return {
    ok: true as const,
    data: user,
  };
}
