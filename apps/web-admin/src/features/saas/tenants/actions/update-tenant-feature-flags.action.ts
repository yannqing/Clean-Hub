"use server";

import type { AuthContext } from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

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

function canWriteTenant(authContext: AuthContext): boolean {
  return Boolean(
    authContext.tenantId === null &&
      (authContext.role === "super_admin" ||
        authContext.permissions.includes("saas:tenant:write")),
  );
}

export async function updateTenantFeatureFlagsAction(
  tenantId: string,
  input: TenantFeatureFlagsFormValues,
): Promise<TenantFeatureFlagsActionResult> {
  const requestOptions = await getSaasServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!authContext || !canWriteTenant(authContext)) {
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
