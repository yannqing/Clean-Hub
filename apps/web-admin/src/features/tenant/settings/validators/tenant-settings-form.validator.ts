import type {
  TenantDefaultCurrencyFormValues,
  TenantSettingsFormValues,
  TenantSettingsLanguage,
  UpdateTenantSettingsRequest,
} from "../types";
import { isSupportedTimeZone } from "@cleanhub/domain/timezone";

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

export type TenantDefaultCurrencyValidationResult =
  | {
      ok: true;
      data: UpdateTenantSettingsRequest;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantDefaultCurrencyFormValues, string>>;
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
  const timezone = input.timezone.trim();

  if (!isTenantSettingsLanguage(input.defaultLanguage)) {
    errors.defaultLanguage = "Select a valid language.";
  }

  if (!timezone) {
    errors.timezone = "Timezone is required.";
  } else if (timezone.length > 64) {
    errors.timezone = "Timezone must be 64 characters or fewer.";
  } else if (!isSupportedTimeZone(timezone)) {
    errors.timezone = "Select a valid IANA timezone.";
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
      timezone,
    },
  };
}

export function validateTenantDefaultCurrencyForm(
  input: TenantDefaultCurrencyFormValues,
): TenantDefaultCurrencyValidationResult {
  const defaultCurrency = input.defaultCurrency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(defaultCurrency)) {
    return {
      ok: false,
      errors: {
        defaultCurrency: "Currency must be a 3-letter code.",
      },
      message: "Currency must be a 3-letter code.",
    };
  }

  return {
    ok: true,
    data: { defaultCurrency },
  };
}
