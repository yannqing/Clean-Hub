import { webAdminApi } from "@/lib/api-client";

import type { TenantFormValues } from "../types";
import { validateTenantForm } from "../validators";

export async function createTenantAction(input: TenantFormValues) {
  const validation = validateTenantForm(input);

  if (!validation.ok) {
    return validation;
  }

  const tenant = await webAdminApi.saas.tenants.create(validation.data);

  return {
    ok: true as const,
    data: tenant,
  };
}
