import type {
  CreateTenantRequest,
  TenantFormValues,
  UpdateTenantRequest,
  UpdateTenantSettingsRequest,
} from "../types";

export type TenantFormValidationResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantFormValues, string>>;
    };

function normalizeOptional(value: string): string | undefined {
  const trimmed = value.trim();

  return trimmed ? trimmed : undefined;
}

function normalizeNullable(value: string): string | null {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function isValidDefaultLanguage(
  value: string,
): value is TenantFormValues["defaultLanguage"] {
  return value === "en" || value === "fr" || value === "zh-CN";
}

function validateTenantBasics(input: TenantFormValues): {
  errors: Partial<Record<keyof TenantFormValues, string>>;
  name: string;
  pressingCode: string;
  country: string;
  contactEmail: string | undefined;
} {
  const errors: Partial<Record<keyof TenantFormValues, string>> = {};
  const name = input.name.trim();
  const pressingCode = input.pressingCode.trim().toUpperCase();
  const country = input.country.trim();
  const contactEmail = normalizeOptional(input.contactEmail);
  const city = normalizeOptional(input.city);
  const contactName = normalizeOptional(input.contactName);
  const contactPhone = normalizeOptional(input.contactPhone);

  if (!name) {
    errors.name = "Tenant name is required.";
  } else if (name.length > 160) {
    errors.name = "Tenant name must be 160 characters or fewer.";
  }

  if (!pressingCode) {
    errors.pressingCode = "Pressing code is required.";
  } else if (pressingCode.length > 80) {
    errors.pressingCode = "Pressing code must be 80 characters or fewer.";
  }

  if (!country) {
    errors.country = "Country is required.";
  } else if (country.length > 80) {
    errors.country = "Country must be 80 characters or fewer.";
  }

  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    errors.contactEmail = "Enter a valid email address.";
  } else if (contactEmail && contactEmail.length > 320) {
    errors.contactEmail = "Email must be 320 characters or fewer.";
  }

  if (city && city.length > 120) {
    errors.city = "City must be 120 characters or fewer.";
  }

  if (contactName && contactName.length > 120) {
    errors.contactName = "Contact name must be 120 characters or fewer.";
  }

  if (contactPhone && contactPhone.length > 32) {
    errors.contactPhone = "Contact phone must be 32 characters or fewer.";
  }

  return {
    errors,
    name,
    pressingCode,
    country,
    contactEmail,
  };
}

function validateSettings(input: TenantFormValues): {
  errors: Partial<Record<keyof TenantFormValues, string>>;
  defaultLanguage: TenantFormValues["defaultLanguage"];
  defaultCurrency: string;
} {
  const errors: Partial<Record<keyof TenantFormValues, string>> = {};
  const defaultCurrency = input.defaultCurrency.trim().toUpperCase();
  const defaultLanguage = input.defaultLanguage;

  if (!isValidDefaultLanguage(defaultLanguage)) {
    errors.defaultLanguage = "Select a valid default language.";
  }

  if (!/^[A-Z]{3}$/.test(defaultCurrency)) {
    errors.defaultCurrency = "Currency must be a 3-letter code.";
  }

  return {
    errors,
    defaultLanguage,
    defaultCurrency,
  };
}

export function validateTenantForm(
  input: TenantFormValues,
): TenantFormValidationResult<CreateTenantRequest> {
  const basics = validateTenantBasics(input);
  const settings = validateSettings(input);
  const errors = {
    ...basics.errors,
    ...settings.errors,
  };

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    data: {
      name: basics.name,
      pressingCode: basics.pressingCode,
      country: basics.country,
      city: normalizeOptional(input.city),
      defaultLanguage: settings.defaultLanguage,
      defaultCurrency: settings.defaultCurrency,
      contactName: normalizeOptional(input.contactName),
      contactPhone: normalizeOptional(input.contactPhone),
      contactEmail: basics.contactEmail,
    },
  };
}

export function validateTenantUpdateForm(
  input: TenantFormValues,
): TenantFormValidationResult<UpdateTenantRequest> {
  const basics = validateTenantBasics(input);

  if (Object.keys(basics.errors).length > 0) {
    return {
      ok: false,
      errors: basics.errors,
    };
  }

  return {
    ok: true,
    data: {
      name: basics.name,
      pressingCode: basics.pressingCode,
      country: basics.country,
      city: normalizeNullable(input.city),
      contactName: normalizeNullable(input.contactName),
      contactPhone: normalizeNullable(input.contactPhone),
      contactEmail: normalizeNullable(input.contactEmail),
    },
  };
}

export function validateTenantSettingsForm(
  input: TenantFormValues,
): TenantFormValidationResult<UpdateTenantSettingsRequest> {
  const settings = validateSettings(input);

  if (Object.keys(settings.errors).length > 0) {
    return {
      ok: false,
      errors: settings.errors,
    };
  }

  return {
    ok: true,
    data: {
      defaultLanguage: settings.defaultLanguage,
      defaultCurrency: settings.defaultCurrency,
    },
  };
}
