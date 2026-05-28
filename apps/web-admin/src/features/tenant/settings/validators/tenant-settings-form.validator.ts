import type {
  TenantSettingsFormValues,
  TenantSettingsLanguage,
  UpdateTenantSettingsRequest,
} from "../types";

export type TenantSettingsValidationResult =
  | {
      ok: true;
      data: UpdateTenantSettingsRequest;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantSettingsFormValues, string>>;
      message?: string;
    };

function isTenantSettingsLanguage(
  value: string,
): value is TenantSettingsLanguage {
  return value === "en" || value === "fr" || value === "zh-CN";
}

export function validateTenantSettingsForm(
  input: TenantSettingsFormValues,
): TenantSettingsValidationResult {
  const errors: Partial<Record<keyof TenantSettingsFormValues, string>> = {};
  const defaultCurrency = input.defaultCurrency.trim().toUpperCase();
  const timezone = input.timezone.trim();

  if (!isTenantSettingsLanguage(input.defaultLanguage)) {
    errors.defaultLanguage = "Select a valid language.";
  }

  if (!/^[A-Z]{3}$/.test(defaultCurrency)) {
    errors.defaultCurrency = "Currency must be a 3-letter code.";
  }

  if (!timezone) {
    errors.timezone = "Timezone is required.";
  } else if (timezone.length > 64) {
    errors.timezone = "Timezone must be 64 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
      message: Object.values(errors)[0],
    };
  }

  return {
    ok: true,
    data: {
      defaultLanguage: input.defaultLanguage,
      defaultCurrency,
      timezone,
    },
  };
}

