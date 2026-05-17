import { webAdminApi } from "@/lib/api-client";

import type { TenantFormValues } from "../types";
import { validateTenantUpdateForm } from "../validators";

export async function updateTenantAction(
  tenantId: string,
  input: TenantFormValues,
) {
  const validation = validateTenantUpdateForm(input);

  if (!validation.ok) {
    return validation;
  }

  const tenant = await webAdminApi.saas.tenants.update(tenantId, validation.data);

  return {
    ok: true as const,
    data: tenant,
  };
}
