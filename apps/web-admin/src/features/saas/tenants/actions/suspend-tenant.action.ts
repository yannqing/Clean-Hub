import { isApiHttpError, type TenantStatus } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { TenantDetail } from "../types";

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

function getStatusActionErrorMessage(error: unknown): string {
  if (!isApiHttpError(error)) {
    return error instanceof Error
      ? error.message
      : "Tenant status could not be updated.";
  }

  if (error.status === 403) {
    return "You do not have permission to update tenant status.";
  }

  if (error.status === 404) {
    return "Tenant was not found.";
  }

  if (error.status === 409) {
    return error.message || "Tenant status could not be updated right now.";
  }

  if (error.status === 422) {
    return error.message || "Please correct the tenant status request.";
  }

  return error.message || "Tenant status could not be updated.";
}

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
      message: getStatusActionErrorMessage(error),
    };
  }
}

export const updateTenantStatusAction = suspendTenantAction;
