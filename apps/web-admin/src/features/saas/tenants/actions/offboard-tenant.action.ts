"use server";

import { revalidatePath } from "next/cache";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";
import { canOffboardTenant } from "@/lib/permissions";

import type { TenantDetail } from "../types";
import { getTenantStatusActionErrorResult } from "./tenant-action-errors";

type TenantOffboardActionResult =
  | {
      ok: true;
      data: TenantDetail;
      /** Tables covered by the export taken before access was cut. */
      exportedTables: number;
    }
  | {
      ok: false;
      errors: {
        reason?: string;
      };
      message: string;
    };

type TenantRestoreActionResult =
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

const FORBIDDEN_MESSAGE = "You do not have permission to offboard tenants.";
const REASON_REQUIRED_MESSAGE = "Reason is required.";

function revalidateTenant(tenantId: string): void {
  revalidatePath("/saas");
  revalidatePath("/saas/tenants");
  revalidatePath(`/saas/tenants/${tenantId}`);
  revalidatePath(`/saas/tenants/${tenantId}/settings`);
}

/**
 * Start a tenant's offboarding.
 *
 * The API takes a data export before cutting access, so the result reports how
 * many tables it covered — the operator should see that the data was captured,
 * not just that the tenant was disabled.
 */
export async function offboardTenantAction(
  tenantId: string,
  input: { reason: string; retentionDays?: number },
): Promise<TenantOffboardActionResult> {
  const requestOptions = await getSaasServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!canOffboardTenant(authContext)) {
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
      errors: { reason: REASON_REQUIRED_MESSAGE },
      message: REASON_REQUIRED_MESSAGE,
    };
  }

  try {
    const result = await webAdminApi.saas.tenants.offboard(
      tenantId,
      {
        reason,
        ...(input.retentionDays === undefined
          ? {}
          : { retentionDays: input.retentionDays }),
      },
      requestOptions,
    );

    revalidateTenant(tenantId);

    return {
      ok: true as const,
      data: result.tenant,
      exportedTables: result.exportedTables,
    };
  } catch (error) {
    return getTenantStatusActionErrorResult(error);
  }
}

/** Cancel an offboarding while the tenant is still inside its retention window. */
export async function restoreTenantAction(
  tenantId: string,
  input: { reason: string },
): Promise<TenantRestoreActionResult> {
  const requestOptions = await getSaasServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!canOffboardTenant(authContext)) {
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
      errors: { reason: REASON_REQUIRED_MESSAGE },
      message: REASON_REQUIRED_MESSAGE,
    };
  }

  try {
    const tenant = await webAdminApi.saas.tenants.restore(
      tenantId,
      { reason },
      requestOptions,
    );

    revalidateTenant(tenantId);

    return {
      ok: true as const,
      data: tenant,
    };
  } catch (error) {
    return getTenantStatusActionErrorResult(error);
  }
}
