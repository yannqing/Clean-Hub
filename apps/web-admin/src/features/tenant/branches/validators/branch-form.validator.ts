import type {
  CreateBranchRequest,
  UpdateBranchRequest,
} from "@cleanhub/api-client";

import type { BranchFormValues, ParsedBranchBusinessHours } from "../types";

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

function parseBusinessHours(
  value: string,
  errors: Partial<Record<keyof BranchFormValues, string>>,
): ParsedBranchBusinessHours {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.businessHours = "Business hours must be a JSON object.";
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    errors.businessHours = "Business hours must be valid JSON.";
    return null;
  }
}

function validateBase(input: BranchFormValues) {
  const errors: Partial<Record<keyof BranchFormValues, string>> = {};
  const name = input.name.trim();
  const defaultCurrency = input.defaultCurrency.trim().toUpperCase();
  const logoUrl = normalizeOptional(input.logoUrl);

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

  if (!["en", "fr", "zh-CN"].includes(input.defaultLanguage)) {
    errors.defaultLanguage = "Choose a supported language.";
  }

  if (!/^[A-Z]{3}$/.test(defaultCurrency)) {
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

  if (!["active", "inactive"].includes(input.status)) {
    errors.status = "Choose a supported status.";
  }

  return {
    errors,
    data: {
      name,
      address: normalizeOptional(input.address),
      phone: normalizeOptional(input.phone),
      businessHours: parseBusinessHours(input.businessHours, errors),
      defaultLanguage: input.defaultLanguage,
      defaultCurrency,
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
  const validation = validateBranchForm(input);

  if (!validation.ok) {
    return validation;
  }

  const version = input.version;

  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    return {
      ok: false,
      errors: {
        version: "Refresh the branch before saving changes.",
      },
    };
  }

  const data = { ...validation.data };
  delete data.status;

  return {
    ok: true,
    data: {
      ...data,
      version,
    },
  };
}
