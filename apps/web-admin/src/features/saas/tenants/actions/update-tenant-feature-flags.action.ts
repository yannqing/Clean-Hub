"use server";

import { revalidatePath } from "next/cache";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";
import { canWriteTenant } from "@/lib/permissions";

import type {
  TenantFeatureFlags,
  TenantFeatureFlagsFormValues,
} from "../types";
import { validateTenantFeatureFlagsForm } from "../validators";
import { getTenantFeatureFlagsActionErrorResult } from "./tenant-action-errors";

type TenantFeatureFlagsActionResult =
  | {
      ok: true;
      data: TenantFeatureFlags;
    }
  | {
      ok: false;
      error: string;
    };

const FORBIDDEN_MESSAGE =
  "Tenant feature flag updates require Super Admin or SaaS tenant write permission.";

export async function updateTenantFeatureFlagsAction(
  tenantId: string,
  input: TenantFeatureFlagsFormValues,
): Promise<TenantFeatureFlagsActionResult> {
  const requestOptions = await getSaasServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!canWriteTenant(authContext)) {
    return {
      ok: false,
      error: FORBIDDEN_MESSAGE,
    };
  }

  const validation = validateTenantFeatureFlagsForm(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const featureFlags = await webAdminApi.saas.tenants.updateFeatureFlags(
      tenantId,
      validation.data,
      requestOptions,
    );

    revalidatePath("/saas");
    revalidatePath("/saas/tenants");
    revalidatePath(`/saas/tenants/${tenantId}`);
    revalidatePath(`/saas/tenants/${tenantId}/settings`);

    return {
      ok: true,
      data: featureFlags,
    };
  } catch (error) {
    return getTenantFeatureFlagsActionErrorResult(error);
  }
}
