import type {
  CreateBranchRequest,
  UpdateBranchRequest,
} from "@cleanhub/api-client";

import type {
  BranchFormValues,
  BranchLanguage,
  BranchStatus,
} from "../types";

const languages: BranchLanguage[] = ["en", "fr", "zh-CN"];
const statuses: BranchStatus[] = ["active", "inactive"];

export type BranchFormValidationResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof BranchFormValues, string>>;
    };

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function parseBusinessHours(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return {
      ok: true as const,
      data: null,
    };
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);

    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return {
        ok: false as const,
        message: "Business hours must be a JSON object.",
      };
    }

    return {
      ok: true as const,
      data: parsed as Record<string, unknown>,
    };
  } catch {
    return {
      ok: false as const,
      message: "Business hours must be valid JSON.",
    };
  }
}

function validateBase(input: BranchFormValues) {
  const errors: Partial<Record<keyof BranchFormValues, string>> = {};
  const name = input.name.trim();
  const currency = input.defaultCurrency.trim().toUpperCase();
  const logoUrl = normalizeOptional(input.logoUrl);
  const businessHours = parseBusinessHours(input.businessHoursJson);

  if (!name) {
    errors.name = "Branch name is required.";
  } else if (name.length > 200) {
    errors.name = "Branch name must be 200 characters or fewer.";
  }

  if (input.address.trim().length > 500) {
    errors.address = "Address must be 500 characters or fewer.";
  }

  if (input.phone.trim().length > 32) {
    errors.phone = "Phone must be 32 characters or fewer.";
  }

  if (!languages.includes(input.defaultLanguage)) {
    errors.defaultLanguage = "Choose a supported default language.";
  }

  if (!/^[A-Z]{3}$/.test(currency)) {
    errors.defaultCurrency = "Currency must be a 3-letter code.";
  }

  if (input.receiptName.trim().length > 200) {
    errors.receiptName = "Receipt name must be 200 characters or fewer.";
  }

  if (input.receiptPhone.trim().length > 32) {
    errors.receiptPhone = "Receipt phone must be 32 characters or fewer.";
  }

  if (input.receiptAddress.trim().length > 500) {
    errors.receiptAddress = "Receipt address must be 500 characters or fewer.";
  }

  if (logoUrl) {
    try {
      new URL(logoUrl);
    } catch {
      errors.logoUrl = "Logo URL must be a valid absolute URL.";
    }
  }

  if (!businessHours.ok) {
    errors.businessHoursJson = businessHours.message;
  }

  if (!statuses.includes(input.status)) {
    errors.status = "Choose a supported status.";
  }

  return {
    errors,
    data: {
      name,
      address: normalizeOptional(input.address),
      phone: normalizeOptional(input.phone),
      businessHours: businessHours.ok ? businessHours.data : null,
      defaultLanguage: input.defaultLanguage,
      defaultCurrency: currency,
      receiptName: normalizeOptional(input.receiptName),
      receiptPhone: normalizeOptional(input.receiptPhone),
      receiptAddress: normalizeOptional(input.receiptAddress),
      logoUrl,
      status: input.status,
    },
  };
}

export function validateBranchForm(
  input: BranchFormValues,
): BranchFormValidationResult<CreateBranchRequest> {
  const result = validateBase(input);

  if (Object.keys(result.errors).length > 0) {
    return {
      ok: false,
      errors: result.errors,
    };
  }

  return {
    ok: true,
    data: result.data,
  };
}

export function validateBranchUpdateForm(
  input: BranchFormValues,
): BranchFormValidationResult<UpdateBranchRequest> {
  const result = validateBase(input);

  if (Object.keys(result.errors).length > 0) {
    return {
      ok: false,
      errors: result.errors,
    };
  }

  if (!input.version) {
    return {
      ok: false,
      errors: {
        version: "Branch version is required. Refresh and try again.",
      },
    };
  }

  return {
    ok: true,
    data: {
      name: result.data.name,
      address: result.data.address,
      phone: result.data.phone,
      businessHours: result.data.businessHours,
      defaultLanguage: result.data.defaultLanguage,
      defaultCurrency: result.data.defaultCurrency,
      receiptName: result.data.receiptName,
      receiptPhone: result.data.receiptPhone,
      receiptAddress: result.data.receiptAddress,
      logoUrl: result.data.logoUrl,
      version: input.version,
    },
  };
}
