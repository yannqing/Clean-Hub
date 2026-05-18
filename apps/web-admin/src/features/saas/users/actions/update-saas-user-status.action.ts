import { webAdminApi } from "@/lib/api-client";

import type { SaasUserDetail, UpdateSaasUserStatusRequest } from "../types";

export async function updateSaasUserStatusAction(
  userId: string,
  input: UpdateSaasUserStatusRequest,
) {
  const reason = input.reason.trim();

  if (!reason) {
    return {
      ok: false as const,
      errors: {
        reason: "Reason is required.",
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
