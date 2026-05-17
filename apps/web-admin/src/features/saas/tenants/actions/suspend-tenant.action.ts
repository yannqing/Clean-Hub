import type { TenantStatus } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

export async function suspendTenantAction(
  tenantId: string,
  input: { reason: string; status?: TenantStatus },
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

  const tenant = await webAdminApi.saas.tenants.updateStatus(tenantId, {
    reason,
    status: input.status ?? "suspended",
  });

  return {
    ok: true as const,
    data: tenant,
  };
}
