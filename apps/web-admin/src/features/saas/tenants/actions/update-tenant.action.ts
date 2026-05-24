import { webAdminApi } from "@/lib/api-client";

import type { TenantFormValues } from "../types";
import { validateTenantUpdateForm } from "../validators";
import { getTenantFormActionErrorResult } from "./tenant-action-errors";

export async function updateTenantAction(
  tenantId: string,
  input: TenantFormValues,
) {
  const validation = validateTenantUpdateForm(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const tenant = await webAdminApi.saas.tenants.update(
      tenantId,
      validation.data,
    );

    return {
      ok: true as const,
      data: tenant,
    };
  } catch (error) {
    return getTenantFormActionErrorResult(error, {
      fallbackMessage: "Tenant could not be updated.",
      forbiddenMessage: "Only super admins can update tenants.",
      notFoundMessage: "Tenant was not found.",
    });
  }
}
