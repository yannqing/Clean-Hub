import { isApiHttpError } from "@cleanhub/api-client";

import type {
  TenantFeatureFlagsFormValues,
  TenantFormValues,
  TenantSettingsFormValues,
} from "../types";

export const tenantFormFieldNames = [
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

export const tenantSettingsFieldNames = [
  "defaultLanguage",
  "defaultCurrency",
] as const satisfies ReadonlyArray<keyof TenantSettingsFormValues>;

export const tenantFeatureFlagFieldNames = [
  "laundryEnabled",
  "carWashEnabled",
  "retailProductsEnabled",
  "deliveryEnabled",
  "notificationsEnabled",
] as const satisfies ReadonlyArray<keyof TenantFeatureFlagsFormValues>;

type FieldName<TFields extends string> = readonly TFields[];
type FieldErrorMap<TFields extends string> = Partial<Record<TFields, string>>;

type FlattenedValidationErrors = {
  fieldErrors?: Record<string, string[] | undefined>;
  formErrors?: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function getUnknownErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  return error instanceof Error ? error.message : fallbackMessage;
}

function getValidationErrors<TFields extends string>(
  validationErrors: unknown,
  fieldNames: FieldName<TFields>,
): FieldErrorMap<TFields> {
  const errors: FieldErrorMap<TFields> = {};

  if (Array.isArray(validationErrors)) {
    for (const validationError of validationErrors) {
      if (!isRecord(validationError)) {
        continue;
      }

      const field = validationError.field;
      const message = validationError.message;

      if (
        typeof field === "string" &&
        typeof message === "string" &&
        fieldNames.includes(field as TFields)
      ) {
        errors[field as TFields] = message;
      }
    }

    return errors;
  }

  if (!isRecord(validationErrors)) {
    return errors;
  }

  const flattened = validationErrors as FlattenedValidationErrors;

  for (const fieldName of fieldNames) {
    const fieldMessages = flattened.fieldErrors?.[fieldName];
    const firstMessage = fieldMessages?.find(Boolean);

    if (firstMessage) {
      errors[fieldName] = firstMessage;
    }
  }

  return errors;
}

export function getTenantFormActionErrorResult(
  error: unknown,
  options: {
    fallbackMessage: string;
    forbiddenMessage: string;
    notFoundMessage?: string;
  },
): {
  ok: false;
  errors: Partial<Record<keyof TenantFormValues, string>>;
  message: string;
} {
  if (!isApiHttpError(error)) {
    return {
      ok: false,
      errors: {},
      message: getUnknownErrorMessage(error, options.fallbackMessage),
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
        "Tenant database schema is out of date. Run database migrations before managing tenants.",
    };
  }

  const validationErrors = getValidationErrors(
    error.validationErrors,
    tenantFormFieldNames,
  );

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
      message: options.forbiddenMessage,
    };
  }

  if (error.status === 404) {
    return {
      ok: false,
      errors: {},
      message: options.notFoundMessage ?? "Tenant was not found.",
    };
  }

  return {
    ok: false,
    errors: {},
    message: error.message || options.fallbackMessage,
  };
}

export function getTenantSettingsActionErrorResult(
  error: unknown,
): {
  ok: false;
  errors: Partial<Record<keyof TenantSettingsFormValues, string>>;
  message: string;
} {
  const fallbackMessage = "Tenant settings could not be updated.";

  if (!isApiHttpError(error)) {
    return {
      ok: false,
      errors: {},
      message: getUnknownErrorMessage(error, fallbackMessage),
    };
  }

  const validationErrors = getValidationErrors(
    error.validationErrors,
    tenantSettingsFieldNames,
  );

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
      message: "Only super admins can update tenant settings.",
    };
  }

  if (error.status === 404) {
    return {
      ok: false,
      errors: {},
      message: "Tenant was not found.",
    };
  }

  return {
    ok: false,
    errors: {},
    message: error.message || fallbackMessage,
  };
}

export function getTenantFeatureFlagsActionErrorResult(error: unknown): {
  ok: false;
  error: string;
} {
  const fallbackMessage = "Tenant feature flags could not be updated.";

  if (!isApiHttpError(error)) {
    return {
      ok: false,
      error: getUnknownErrorMessage(error, fallbackMessage),
    };
  }

  const validationErrors = getValidationErrors(
    error.validationErrors,
    tenantFeatureFlagFieldNames,
  );
  const firstValidationError = Object.values(validationErrors)[0];

  if (firstValidationError) {
    return {
      ok: false,
      error: firstValidationError,
    };
  }

  if (error.status === 403) {
    return {
      ok: false,
      error: "Only super admins can update tenant feature flags.",
    };
  }

  if (error.status === 404) {
    return {
      ok: false,
      error: "Tenant was not found.",
    };
  }

  return {
    ok: false,
    error: error.message || fallbackMessage,
  };
}

export function getTenantStatusActionErrorMessage(error: unknown): string {
  if (!isApiHttpError(error)) {
    return getUnknownErrorMessage(
      error,
      "Tenant status could not be updated.",
    );
  }

  if (error.status === 403) {
    return "You do not have permission to update tenant status.";
  }

  if (error.status === 404) {
    return "Tenant was not found.";
  }

  if (error.status === 409) {
    return error.message || "Tenant status could not be updated right now.";
  }

  if (error.status === 422) {
    return error.message || "Please correct the tenant status request.";
  }

  return error.message || "Tenant status could not be updated.";
}
