import { webAdminApi } from "@/lib/api-client";

import type { TenantSettingsFormValues } from "../types";
import { validateTenantSettingsForm } from "../validators";

export async function updateTenantSettingsAction(
  tenantId: string,
  input: TenantSettingsFormValues,
) {
  const validation = validateTenantSettingsForm(input);

  if (!validation.ok) {
    return validation;
  }

  const settings = await webAdminApi.saas.tenants.updateSettings(
    tenantId,
    validation.data,
  );

  return {
    ok: true as const,
    data: settings,
  };
}
