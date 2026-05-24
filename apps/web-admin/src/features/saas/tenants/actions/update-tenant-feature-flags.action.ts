import { webAdminApi } from "@/lib/api-client";

import type { TenantFeatureFlagsFormValues } from "../types";
import { validateTenantFeatureFlagsForm } from "../validators";

export async function updateTenantFeatureFlagsAction(
  tenantId: string,
  input: TenantFeatureFlagsFormValues,
) {
  const validation = validateTenantFeatureFlagsForm(input);

  if (!validation.ok) {
    return validation;
  }

  const featureFlags = await webAdminApi.saas.tenants.updateFeatureFlags(
    tenantId,
    validation.data,
  );

  return {
    ok: true as const,
    data: featureFlags,
  };
}
