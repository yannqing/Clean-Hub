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

  if (!name) {
    errors.name = "Tenant name is required.";
  }

  if (!pressingCode) {
    errors.pressingCode = "Pressing code is required.";
  }

  if (!country) {
    errors.country = "Country is required.";
  }

  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    errors.contactEmail = "Enter a valid email address.";
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
  defaultCurrency: string;
} {
  const errors: Partial<Record<keyof TenantFormValues, string>> = {};
  const defaultCurrency = input.defaultCurrency.trim().toUpperCase();

  if (defaultCurrency.length !== 3) {
    errors.defaultCurrency = "Currency must be a 3-letter code.";
  }

  return {
    errors,
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
      defaultLanguage: input.defaultLanguage,
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
      defaultLanguage: input.defaultLanguage,
      defaultCurrency: settings.defaultCurrency,
    },
  };
}
