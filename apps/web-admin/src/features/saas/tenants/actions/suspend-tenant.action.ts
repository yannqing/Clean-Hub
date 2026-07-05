"use server";

import type { AuthContext, TenantStatus } from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

import type { TenantDetail } from "../types";
import { getTenantStatusActionErrorResult } from "./tenant-action-errors";

type TenantStatusActionResult =
  | {
      ok: true;
      data: TenantDetail;
    }
  | {
      ok: false;
      errors: {
        reason?: string;
        status?: string;
      };
      message: string;
    };

const FORBIDDEN_MESSAGE = "You do not have permission to update tenant status.";

function canUpdateTenantStatus(authContext: AuthContext): boolean {
  return authContext.role === "super_admin" && authContext.tenantId === null;
}

export async function suspendTenantAction(
  tenantId: string,
  input: { reason: string; status?: TenantStatus },
): Promise<TenantStatusActionResult> {
  const requestOptions = await getSaasServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!authContext || !canUpdateTenantStatus(authContext)) {
    return {
      ok: false as const,
      errors: {},
      message: FORBIDDEN_MESSAGE,
    };
  }

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
    const tenant = await webAdminApi.saas.tenants.updateStatus(
      tenantId,
      {
        reason,
        status: input.status ?? "suspended",
      },
      requestOptions,
    );

    revalidatePath("/saas");
    revalidatePath("/saas/tenants");
    revalidatePath(`/saas/tenants/${tenantId}`);
    revalidatePath(`/saas/tenants/${tenantId}/settings`);

    return {
      ok: true as const,
      data: tenant,
    };
  } catch (error) {
    return getTenantStatusActionErrorResult(error);
  }
}

export const updateTenantStatusAction = suspendTenantAction;
