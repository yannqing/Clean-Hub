import type {
  CreateTenantRequest,
  TenantLanguage,
  TenantFeatureFlagsFormValues,
  TenantFormValues,
  TenantSettingsFormValues,
  UpdateTenantFeatureFlagsRequest,
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

export type TenantSettingsValidationResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantSettingsFormValues, string>>;
    };

export type TenantFeatureFlagsValidationResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      error: string;
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
): value is TenantLanguage {
  return value === "en" || value === "fr" || value === "zh-CN";
}

function validateTenantBasics(input: TenantFormValues, requirePressingCode: boolean): {
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
    errors.name = "Merchant name is required.";
  } else if (name.length > 160) {
    errors.name = "Merchant name must be 160 characters or fewer.";
  }

  if (requirePressingCode && !pressingCode) {
    errors.pressingCode = "Tenant code is required.";
  } else if (requirePressingCode && pressingCode.length > 80) {
    errors.pressingCode = "Tenant code must be 80 characters or fewer.";
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

function validateSettings(input: TenantSettingsFormValues): {
  errors: Partial<Record<keyof TenantSettingsFormValues, string>>;
  defaultLanguage: TenantSettingsFormValues["defaultLanguage"];
  defaultCurrency: string;
} {
  const errors: Partial<Record<keyof TenantSettingsFormValues, string>> = {};
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

function validateCreateDefaults(input: TenantFormValues): {
  errors: Partial<Record<keyof TenantFormValues, string>>;
  defaultLanguage?: TenantLanguage;
  defaultCurrency?: string;
} {
  const errors: Partial<Record<keyof TenantFormValues, string>> = {};
  const defaultCurrency = input.defaultCurrency.trim().toUpperCase();
  const defaultLanguage = input.defaultLanguage;

  if (
    defaultLanguage !== "platform-default" &&
    !isValidDefaultLanguage(defaultLanguage)
  ) {
    errors.defaultLanguage = "Select a valid default language.";
  }

  if (defaultCurrency && !/^[A-Z]{3}$/.test(defaultCurrency)) {
    errors.defaultCurrency = "Currency must be a 3-letter code.";
  }

  return {
    errors,
    defaultLanguage:
      defaultLanguage === "platform-default" ? undefined : defaultLanguage,
    defaultCurrency: defaultCurrency || undefined,
  };
}

function validateInitialOwner(
  input: TenantFormValues,
): {
  errors: Partial<Record<keyof TenantFormValues, string>>;
  initialOwner: CreateTenantRequest["initialOwner"];
} {
  const errors: Partial<Record<keyof TenantFormValues, string>> = {};
  const displayName = input.initialOwnerDisplayName.trim();
  const email = normalizeOptional(input.initialOwnerEmail);
  const phone = normalizeOptional(input.initialOwnerPhone);

  if (!displayName) {
    errors.initialOwnerDisplayName = "Owner name is required.";
  } else if (displayName.length > 120) {
    errors.initialOwnerDisplayName = "Owner name must be 120 characters or fewer.";
  }

  if (!email) {
    errors.initialOwnerEmail = "Owner email is required.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.initialOwnerEmail = "Enter a valid owner email address.";
  } else if (email.length > 320) {
    errors.initialOwnerEmail = "Owner email must be 320 characters or fewer.";
  }

  if (phone && phone.length > 32) {
    errors.initialOwnerPhone = "Owner phone must be 32 characters or fewer.";
  }

  return {
    errors,
    initialOwner: email
      ? {
          displayName,
          email,
          phone,
        }
      : undefined,
  };
}

export function validateTenantForm(
  input: TenantFormValues,
): TenantFormValidationResult<CreateTenantRequest> {
  const basics = validateTenantBasics(input, false);
  const settings = validateCreateDefaults(input);
  const owner = validateInitialOwner(input);
  const errors = {
    ...basics.errors,
    ...settings.errors,
    ...owner.errors,
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
      country: basics.country,
      city: normalizeOptional(input.city),
      defaultLanguage: settings.defaultLanguage,
      defaultCurrency: settings.defaultCurrency,
      contactName: normalizeOptional(input.contactName),
      contactPhone: normalizeOptional(input.contactPhone),
      contactEmail: basics.contactEmail,
      initialOwner: owner.initialOwner,
    },
  };
}

export function validateTenantUpdateForm(
  input: TenantFormValues,
): TenantFormValidationResult<UpdateTenantRequest> {
  const basics = validateTenantBasics(input, true);

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
  input: TenantSettingsFormValues,
): TenantSettingsValidationResult<UpdateTenantSettingsRequest> {
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

export function validateTenantFeatureFlagsForm(
  input: TenantFeatureFlagsFormValues,
): TenantFeatureFlagsValidationResult<UpdateTenantFeatureFlagsRequest> {
  const values = [
    input.laundryEnabled,
    input.carWashEnabled,
    input.retailProductsEnabled,
    input.deliveryEnabled,
    input.notificationsEnabled,
    input.emailEnabled,
    input.customerOtpEnabled,
  ];

  if (values.some((value) => typeof value !== "boolean")) {
    return {
      ok: false,
      error: "Feature flags must be enabled or disabled.",
    };
  }

  return {
    ok: true,
    data: {
      laundryEnabled: input.laundryEnabled,
      carWashEnabled: input.carWashEnabled,
      retailProductsEnabled: input.retailProductsEnabled,
      deliveryEnabled: input.deliveryEnabled,
      notificationsEnabled: input.notificationsEnabled,
      emailEnabled: input.emailEnabled,
      customerOtpEnabled: input.customerOtpEnabled,
    },
  };
}
