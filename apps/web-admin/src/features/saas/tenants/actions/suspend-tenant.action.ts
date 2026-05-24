import type { TenantStatus } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { TenantDetail } from "../types";
import { getTenantStatusActionErrorMessage } from "./tenant-action-errors";

type TenantStatusActionResult =
  | {
      ok: true;
      data: TenantDetail;
    }
  | {
      ok: false;
      errors: {
        reason?: string;
      };
      message: string;
    };

export async function suspendTenantAction(
  tenantId: string,
  input: { reason: string; status?: TenantStatus },
): Promise<TenantStatusActionResult> {
  const reason = input.reason.trim();

  if (!reason) {
    return {
      ok: false as const,
      errors: {
        reason: "Reason is required.",
      },
      message: "Reason is required.",
    };
  }

  try {
    const tenant = await webAdminApi.saas.tenants.updateStatus(tenantId, {
      reason,
      status: input.status ?? "suspended",
    });

    return {
      ok: true as const,
      data: tenant,
    };
  } catch (error) {
    return {
      ok: false,
      errors: {},
      message: getTenantStatusActionErrorMessage(error),
    };
  }
}

export const updateTenantStatusAction = suspendTenantAction;
