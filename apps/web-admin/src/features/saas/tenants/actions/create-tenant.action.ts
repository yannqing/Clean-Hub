import { isApiHttpError } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { TenantFormValues } from "../types";
import { validateTenantForm } from "../validators";

const tenantFormFieldNames = [
  "name",
  "pressingCode",
  "country",
  "city",
  "defaultLanguage",
  "defaultCurrency",
  "contactName",
  "contactPhone",
  "contactEmail",
] as const satisfies ReadonlyArray<keyof TenantFormValues>;

type TenantFormErrorMap = Partial<Record<keyof TenantFormValues, string>>;

function isTenantFormField(field: string): field is keyof TenantFormValues {
  return tenantFormFieldNames.some((fieldName) => fieldName === field);
}

function getCreateTenantErrorResult(error: unknown): {
  ok: false;
  errors: TenantFormErrorMap;
  message: string;
} {
  if (!isApiHttpError(error)) {
    return {
      ok: false,
      errors: {},
      message:
        error instanceof Error ? error.message : "Tenant could not be created.",
    };
  }

  if (error.code === "SAAS_TENANT_PRESSING_CODE_CONFLICT") {
    return {
      ok: false,
      errors: {
        pressingCode: "A tenant with this pressing code already exists.",
      },
      message: "A tenant with this pressing code already exists.",
    };
  }

  if (error.code === "SAAS_TENANT_SCHEMA_MISMATCH") {
    return {
      ok: false,
      errors: {},
      message:
        "Tenant database schema is out of date. Run database migrations before creating tenants.",
    };
  }

  const validationErrors: TenantFormErrorMap = {};

  for (const validationError of error.validationErrors ?? []) {
    if (isTenantFormField(validationError.field)) {
      validationErrors[validationError.field] = validationError.message;
    }
  }

  if (Object.keys(validationErrors).length > 0) {
    return {
      ok: false,
      errors: validationErrors,
      message: "Please correct the highlighted fields.",
    };
  }

  if (error.status === 403) {
    return {
      ok: false,
      errors: {},
      message: "Only super admins can create tenants.",
    };
  }

  return {
    ok: false,
    errors: {},
    message: error.message || "Tenant could not be created.",
  };
}

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
    return getCreateTenantErrorResult(error);
  }
}
