import { webAdminApi } from "@/lib/api-client";

import type { TenantSettingsFormValues } from "../types";
import { validateTenantSettingsForm } from "../validators";
import { getTenantSettingsActionErrorResult } from "./tenant-action-errors";

export async function updateTenantSettingsAction(
  tenantId: string,
  input: TenantSettingsFormValues,
) {
  const validation = validateTenantSettingsForm(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const settings = await webAdminApi.saas.tenants.updateSettings(
      tenantId,
      validation.data,
    );

    return {
      ok: true as const,
      data: settings,
    };
  } catch (error) {
    return getTenantSettingsActionErrorResult(error);
  }
}
