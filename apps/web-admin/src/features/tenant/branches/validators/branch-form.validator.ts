import type {
  BranchBusinessHours,
  CreateBranchRequest,
  UpdateBranchRequest,
} from "@cleanhub/api-client";
import {
  POS_RECEIPT_FIELDS,
  REQUIRED_POS_RECEIPT_FIELDS,
} from "@cleanhub/domain/receipt";

import { branchWeekdays } from "../constants";
import type { BranchFormValues, BranchLanguage, BranchStatus } from "../types";

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

function validateBusinessHours(input: BranchFormValues) {
  const businessHours: BranchBusinessHours = {};

  for (const weekday of branchWeekdays) {
    const hours = input.businessHours[weekday];

    if (!hours.enabled) {
      continue;
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hours.opensAt)) {
      return {
        ok: false as const,
        message: "Choose a valid opening time for every open day.",
      };
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hours.closesAt)) {
      return {
        ok: false as const,
        message: "Choose a valid closing time for every open day.",
      };
    }

    if (hours.opensAt >= hours.closesAt) {
      return {
        ok: false as const,
        message: "Closing time must be later than opening time.",
      };
    }

    businessHours[weekday] = {
      opensAt: hours.opensAt,
      closesAt: hours.closesAt,
    };
  }

  return {
    ok: true as const,
    data: Object.keys(businessHours).length > 0 ? businessHours : null,
  };
}

function validateBase(input: BranchFormValues) {
  const errors: Partial<Record<keyof BranchFormValues, string>> = {};
  const name = input.name.trim();
  const logoObjectKey = normalizeOptional(input.logoObjectKey);
  const businessHours = validateBusinessHours(input);

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

  if (input.receiptName.trim().length > 200) {
    errors.receiptName = "Receipt name must be 200 characters or fewer.";
  }

  if (input.receiptPhone.trim().length > 32) {
    errors.receiptPhone = "Receipt phone must be 32 characters or fewer.";
  }

  if (input.receiptAddress.trim().length > 500) {
    errors.receiptAddress = "Receipt address must be 500 characters or fewer.";
  }

  if (
    input.receiptFields.some((field) => !POS_RECEIPT_FIELDS.includes(field)) ||
    REQUIRED_POS_RECEIPT_FIELDS.some(
      (field) => !input.receiptFields.includes(field),
    )
  ) {
    errors.receiptFields =
      "Choose valid receipt fields. Merchant name is required.";
  }

  if (logoObjectKey && logoObjectKey.length > 1024) {
    errors.logoObjectKey = "The uploaded logo reference is invalid.";
  }

  if (!businessHours.ok) {
    errors.businessHours = businessHours.message;
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
      receiptName: normalizeOptional(input.receiptName),
      receiptPhone: normalizeOptional(input.receiptPhone),
      receiptAddress: normalizeOptional(input.receiptAddress),
      receiptFields: Array.from(new Set(input.receiptFields)),
      logoObjectKey,
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
      receiptName: result.data.receiptName,
      receiptPhone: result.data.receiptPhone,
      receiptAddress: result.data.receiptAddress,
      receiptFields: result.data.receiptFields,
      logoObjectKey: input.removeLogo
        ? null
        : (result.data.logoObjectKey ?? undefined),
      version: input.version,
    },
  };
}

export function validateBranchStatusUpdate(
  status: BranchStatus,
  version: number,
): BranchFormValidationResult<{ status: BranchStatus; version: number }> {
  const errors: Partial<Record<keyof BranchFormValues, string>> = {};

  if (!statuses.includes(status)) {
    errors.status = "Choose a supported status.";
  }

  if (!Number.isInteger(version) || version < 1) {
    errors.version = "Branch version is required. Refresh and try again.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    data: {
      status,
      version,
    },
  };
}
