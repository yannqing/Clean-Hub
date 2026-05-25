import { webAdminApi } from "@/lib/api-client";

import type { TenantFormValues } from "../types";
import { validateTenantForm } from "../validators";
import { getTenantFormActionErrorResult } from "./tenant-action-errors";

export async function createTenantAction(input: TenantFormValues) {
  const validation = validateTenantForm(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const tenant = await webAdminApi.saas.tenants.create(validation.data);

    return {
      ok: true as const,
      data: tenant,
    };
  } catch (error) {
    return getTenantFormActionErrorResult(error, {
      fallbackMessage: "Tenant could not be created.",
      forbiddenMessage: "Only super admins can create tenants.",
    });
  }
}
