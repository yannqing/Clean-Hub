import type {
  TenantTaxRate,
  UpdateTenantTaxRateRequest,
} from "@cleanhub/api-client";

export type TaxRate = TenantTaxRate;
export type UpdateTaxRateInput = UpdateTenantTaxRateRequest;

/**
 * What a service or product form needs to offer a tax rate: the tenant's
 * rates, and the default an item falls back to when it has none of its own.
 */
export type TaxRateOptions = {
  rates: TaxRate[];
  /** Fraction, e.g. "0.1800"; null when POS settings could not be read. */
  defaultRate: string | null;
  taxEnabled: boolean;
  loadFailed: boolean;
};

export type TaxRateActionErrorCode =
  | "nameConflict"
  | "inUse"
  | "versionConflict"
  | "templateManaged"
  | "generic";

export type TaxRateActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: TaxRateActionErrorCode };
