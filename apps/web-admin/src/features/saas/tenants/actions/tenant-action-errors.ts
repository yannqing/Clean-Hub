import {
  isApiHttpError,
  isApiNetworkError,
  isApiTimeoutError,
  type TenantErrorCode,
} from "@cleanhub/api-client";

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

const tenantStatusFieldNames = ["status", "reason"] as const;

type FieldName<TFields extends string> = readonly TFields[];
type FieldErrorMap<TFields extends string> = Partial<Record<TFields, string>>;
type TenantStatusFieldName = (typeof tenantStatusFieldNames)[number];

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

function getTenantErrorCode(error: unknown): TenantErrorCode | undefined {
  if (!isApiHttpError(error)) {
    return undefined;
  }

  return error.code as TenantErrorCode | undefined;
}

function getRequestIdSuffix(error: unknown): string {
  if (
    error instanceof Error &&
    "requestId" in error &&
    typeof error.requestId === "string"
  ) {
    return ` Request ID: ${error.requestId}`;
  }

  return "";
}

function getFirstValidationFormError(validationErrors: unknown): string | null {
  if (!isRecord(validationErrors)) {
    return null;
  }

  const formErrors = (validationErrors as FlattenedValidationErrors).formErrors;
  return formErrors?.find(Boolean) ?? null;
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

export function getTenantLoadErrorMessage(
  error: unknown,
  fallbackMessage = "Tenant request failed.",
): string {
  if (isApiTimeoutError(error)) {
    return "The tenant request timed out. Please try again.";
  }

  if (isApiNetworkError(error)) {
    return "The tenant request could not reach the API. Check the API service and try again.";
  }

  if (!isApiHttpError(error)) {
    return getUnknownErrorMessage(error, fallbackMessage);
  }

  const code = getTenantErrorCode(error);

  if (error.status === 401) {
    return "Your session has expired. Please sign in again.";
  }

  if (error.status === 403) {
    return "You do not have permission to access this tenant area.";
  }

  if (error.status === 404 || code === "SAAS_TENANT_NOT_FOUND") {
    return "Tenant was not found.";
  }

  if (error.status === 409) {
    return error.message || "The tenant was changed by another request.";
  }

  if (error.status === 422) {
    return (
      getFirstValidationFormError(error.validationErrors) ??
      error.message ??
      "Please correct the tenant request."
    );
  }

  if (error.status >= 500) {
    return `Tenant service is temporarily unavailable.${getRequestIdSuffix(error)}`;
  }

  return error.message || fallbackMessage;
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
      message: getTenantLoadErrorMessage(error, options.fallbackMessage),
    };
  }

  const code = getTenantErrorCode(error);

  if (code === "SAAS_TENANT_PRESSING_CODE_CONFLICT") {
    return {
      ok: false,
      errors: {
        pressingCode: "A tenant with this pressing code already exists.",
      },
      message: "A tenant with this pressing code already exists.",
    };
  }

  const validationErrors = getValidationErrors(
    error.validationErrors,
    tenantFormFieldNames,
  );
  const formError = getFirstValidationFormError(error.validationErrors);

  if (Object.keys(validationErrors).length > 0) {
    return {
      ok: false,
      errors: validationErrors,
      message: "Please correct the highlighted fields.",
    };
  }

  if (formError) {
    return {
      ok: false,
      errors: {},
      message: formError,
    };
  }

  if (error.status === 401) {
    return {
      ok: false,
      errors: {},
      message: "Your session has expired. Please sign in again.",
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

  if (error.status === 409) {
    return {
      ok: false,
      errors: {},
      message: error.message || "Tenant request conflicts with current data.",
    };
  }

  if (error.status >= 500) {
    return {
      ok: false,
      errors: {},
      message: `Tenant service is temporarily unavailable.${getRequestIdSuffix(error)}`,
    };
  }

  return {
    ok: false,
    errors: {},
    message: error.message || options.fallbackMessage,
  };
}

export function getTenantSettingsActionErrorResult(error: unknown): {
  ok: false;
  errors: Partial<Record<keyof TenantSettingsFormValues, string>>;
  message: string;
} {
  const fallbackMessage = "Tenant settings could not be updated.";

  if (!isApiHttpError(error)) {
    return {
      ok: false,
      errors: {},
      message: getTenantLoadErrorMessage(error, fallbackMessage),
    };
  }

  const validationErrors = getValidationErrors(
    error.validationErrors,
    tenantSettingsFieldNames,
  );
  const formError = getFirstValidationFormError(error.validationErrors);

  if (Object.keys(validationErrors).length > 0) {
    return {
      ok: false,
      errors: validationErrors,
      message: "Please correct the highlighted fields.",
    };
  }

  if (formError) {
    return {
      ok: false,
      errors: {},
      message: formError,
    };
  }

  if (error.status === 401) {
    return {
      ok: false,
      errors: {},
      message: "Your session has expired. Please sign in again.",
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

  if (error.status === 409) {
    return {
      ok: false,
      errors: {},
      message: error.message || "Tenant settings conflict with current data.",
    };
  }

  if (error.status >= 500) {
    return {
      ok: false,
      errors: {},
      message: `Tenant service is temporarily unavailable.${getRequestIdSuffix(error)}`,
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
      error: getTenantLoadErrorMessage(error, fallbackMessage),
    };
  }

  const validationErrors = getValidationErrors(
    error.validationErrors,
    tenantFeatureFlagFieldNames,
  );
  const firstValidationError = Object.values(validationErrors)[0];
  const formError = getFirstValidationFormError(error.validationErrors);

  if (firstValidationError) {
    return {
      ok: false,
      error: firstValidationError,
    };
  }

  if (formError) {
    return {
      ok: false,
      error: formError,
    };
  }

  if (error.status === 401) {
    return {
      ok: false,
      error: "Your session has expired. Please sign in again.",
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

  if (error.status === 409) {
    return {
      ok: false,
      error:
        error.message || "Tenant feature flags conflict with current data.",
    };
  }

  if (error.status >= 500) {
    return {
      ok: false,
      error: `Tenant service is temporarily unavailable.${getRequestIdSuffix(error)}`,
    };
  }

  return {
    ok: false,
    error: error.message || fallbackMessage,
  };
}

export function getTenantStatusActionErrorResult(error: unknown): {
  ok: false;
  errors: FieldErrorMap<TenantStatusFieldName>;
  message: string;
} {
  if (!isApiHttpError(error)) {
    return {
      ok: false,
      errors: {},
      message: getTenantLoadErrorMessage(
        error,
        "Tenant status could not be updated.",
      ),
    };
  }

  if (error.status === 401) {
    return {
      ok: false,
      errors: {},
      message: "Your session has expired. Please sign in again.",
    };
  }

  if (error.status === 403) {
    return {
      ok: false,
      errors: {},
      message: "You do not have permission to update tenant status.",
    };
  }

  if (error.status === 404) {
    return {
      ok: false,
      errors: {},
      message: "Tenant was not found.",
    };
  }

  if (error.status === 409) {
    return {
      ok: false,
      errors: {},
      message: error.message || "Tenant status could not be updated right now.",
    };
  }

  if (error.status === 422) {
    const validationErrors = getValidationErrors(
      error.validationErrors,
      tenantStatusFieldNames,
    );
    const firstValidationError = Object.values(validationErrors)[0];

    return {
      ok: false,
      errors: validationErrors,
      message:
        firstValidationError ??
        getFirstValidationFormError(error.validationErrors) ??
        error.message ??
        "Please correct the tenant status request.",
    };
  }

  if (error.status >= 500) {
    return {
      ok: false,
      errors: {},
      message: `Tenant service is temporarily unavailable.${getRequestIdSuffix(error)}`,
    };
  }

  return {
    ok: false,
    errors: {},
    message: error.message || "Tenant status could not be updated.",
  };
}

export function getTenantStatusActionErrorMessage(error: unknown): string {
  return getTenantStatusActionErrorResult(error).message;
}
