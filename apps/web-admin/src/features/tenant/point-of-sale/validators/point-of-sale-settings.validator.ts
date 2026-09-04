import type {
  UpdatePointOfSaleSettingsInput,
  PointOfSaleSettings,
} from "../types";

export type PointOfSaleSettingsFormValues = Omit<
  PointOfSaleSettings,
  | "id"
  | "tenantId"
  | "createdAt"
  | "updatedAt"
  | "createdBy"
  | "updatedBy"
  | "canManage"
  | "mobileMoneyProvidersEnabled"
>;

export type PointOfSaleSettingsValidationResult =
  | {
      ok: true;
      data: UpdatePointOfSaleSettingsInput;
    }
  | {
      ok: false;
      message: string;
    };

function isWholeNumberInRange(
  value: number,
  minimum: number,
  maximum: number,
): boolean {
  return Number.isInteger(value) && value >= minimum && value <= maximum;
}

export function validatePointOfSaleSettings(
  input: PointOfSaleSettingsFormValues,
): PointOfSaleSettingsValidationResult {
  if (
    input.defaultPaymentMethodsEnabled.length === 0 ||
    !input.defaultPaymentMethodsEnabled.includes(input.defaultPaymentMethod)
  ) {
    return {
      ok: false,
      message: "The default payment method must be enabled.",
    };
  }

  const taxRate = Number(input.defaultTaxRate);
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
    return {
      ok: false,
      message: "VAT rate must be between 0% and 100%.",
    };
  }
  if (!isWholeNumberInRange(input.syncIntervalSeconds, 5, 3600)) {
    return {
      ok: false,
      message: "Sync interval must be between 5 and 3600 seconds.",
    };
  }

  if (!isWholeNumberInRange(input.recentCartRetentionHours, 1, 720)) {
    return {
      ok: false,
      message: "Held-cart retention must be between 1 and 720 hours.",
    };
  }

  if (!isWholeNumberInRange(input.deviceOfflineAfterSeconds, 10, 86400)) {
    return {
      ok: false,
      message: "Offline threshold must be between 10 and 86400 seconds.",
    };
  }

  if (input.deviceOfflineAfterSeconds < input.syncIntervalSeconds * 2) {
    return {
      ok: false,
      message:
        "Offline threshold must be at least twice the synchronization interval.",
    };
  }

  if (!isWholeNumberInRange(input.defaultPrintCopies, 1, 10)) {
    return {
      ok: false,
      message: "Receipt copies must be between 1 and 10.",
    };
  }

  if (!isWholeNumberInRange(input.defaultLockTimeoutSeconds, 30, 86400)) {
    return {
      ok: false,
      message: "Lock timeout must be between 30 and 86400 seconds.",
    };
  }

  return { ok: true, data: input };
}
