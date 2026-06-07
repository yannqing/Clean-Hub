import type { BranchFormValues } from "../types";

type ApiValidationError = {
  field: string;
  message: string;
};

type BranchActionError = {
  message: string;
  code?: string;
  status?: number;
  errors: Partial<Record<keyof BranchFormValues, string>>;
};

const branchFieldMap: Record<string, keyof BranchFormValues> = {
  businessHours: "businessHoursJson",
  defaultCurrency: "defaultCurrency",
  defaultLanguage: "defaultLanguage",
  receiptAddress: "receiptAddress",
  receiptName: "receiptName",
  receiptPhone: "receiptPhone",
};

const branchFormFields = new Set<keyof BranchFormValues>([
  "name",
  "address",
  "phone",
  "defaultLanguage",
  "defaultCurrency",
  "receiptName",
  "receiptPhone",
  "receiptAddress",
  "logoUrl",
  "businessHoursJson",
  "status",
  "version",
]);

function getStringProperty(
  source: { [key: string]: unknown },
  key: string,
): string | undefined {
  return typeof source[key] === "string" ? source[key] : undefined;
}

function getNumberProperty(
  source: { [key: string]: unknown },
  key: string,
): number | undefined {
  return typeof source[key] === "number" ? source[key] : undefined;
}

function getValidationErrors(error: unknown): ApiValidationError[] {
  if (!error || typeof error !== "object") {
    return [];
  }

  const source = error as { [key: string]: unknown };
  const directErrors = source.validationErrors;
  const responseData = source.responseData;
  const nestedErrors =
    responseData && typeof responseData === "object"
      ? (responseData as { validationErrors?: unknown }).validationErrors
      : undefined;
  const validationErrors = Array.isArray(directErrors)
    ? directErrors
    : Array.isArray(nestedErrors)
      ? nestedErrors
      : [];

  return validationErrors.filter(
    (item): item is ApiValidationError =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as ApiValidationError).field === "string" &&
      typeof (item as ApiValidationError).message === "string",
  );
}

function mapFieldErrors(
  validationErrors: ApiValidationError[],
): Partial<Record<keyof BranchFormValues, string>> {
  const errors: Partial<Record<keyof BranchFormValues, string>> = {};

  for (const validationError of validationErrors) {
    const field =
      branchFieldMap[validationError.field] ??
      (validationError.field as keyof BranchFormValues);

    if (branchFormFields.has(field)) {
      errors[field] = validationError.message;
    }
  }

  return errors;
}

export function getBranchActionError(
  error: unknown,
  fallbackMessage: string,
): BranchActionError {
  const source =
    error && typeof error === "object"
      ? (error as { [key: string]: unknown })
      : {};

  return {
    message: error instanceof Error ? error.message : fallbackMessage,
    code: getStringProperty(source, "code"),
    status: getNumberProperty(source, "status"),
    errors: mapFieldErrors(getValidationErrors(error)),
  };
}
