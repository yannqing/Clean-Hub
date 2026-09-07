import type {
  TenantDefaultCurrencyFormValues,
  TenantProfileFormValues,
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

export type TenantProfileValidationResult =
  | {
      ok: true;
      data: UpdateTenantSettingsRequest;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantProfileFormValues, string>>;
      message?: string;
    };

function isTenantSettingsLanguage(
  value: string,
): value is TenantSettingsLanguage {
  return value === "en" || value === "fr" || value === "zh-CN";
}

function nullableTrimmed(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

export function validateTenantProfileForm(
  input: TenantProfileFormValues,
): TenantProfileValidationResult {
  const errors: Partial<Record<keyof TenantProfileFormValues, string>> = {};
  const tenantName = input.tenantName.trim();
  const country = nullableTrimmed(input.country);
  const city = nullableTrimmed(input.city);
  const contactName = nullableTrimmed(input.contactName);
  const contactPhone = nullableTrimmed(input.contactPhone);
  const contactEmail = nullableTrimmed(input.contactEmail);

  if (!tenantName) {
    errors.tenantName = "Tenant name is required.";
  } else if (tenantName.length > 160) {
    errors.tenantName = "Tenant name must be 160 characters or fewer.";
  }
  if (country && country.length > 80) {
    errors.country = "Country or region must be 80 characters or fewer.";
  }
  if (city && city.length > 120) {
    errors.city = "City must be 120 characters or fewer.";
  }
  if (contactName && contactName.length > 120) {
    errors.contactName = "Contact name must be 120 characters or fewer.";
  }
  if (contactPhone && contactPhone.length > 32) {
    errors.contactPhone = "Phone number must be 32 characters or fewer.";
  }
  if (
    contactEmail &&
    (contactEmail.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail))
  ) {
    errors.contactEmail = "Enter a valid email address.";
  }
  if (!Number.isInteger(input.tenantVersion) || input.tenantVersion < 1) {
    errors.tenantVersion = "Reload this page before saving tenant details.";
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
      tenantName,
      country,
      city,
      contactName,
      contactPhone,
      contactEmail,
      tenantVersion: input.tenantVersion,
    },
  };
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
