/**
 * A named tax rate the tenant can put on services and products. Items with no
 * rate of their own are sold at the POS default rate.
 */
export type TenantTaxRate = {
  id: string;
  name: string;
  /** Fraction: "0.1800" is 18%. */
  rate: string;
  displayOrder: number;
  /** Archived rates stay on the items that carry them but cannot be newly assigned. */
  archived: boolean;
  serviceCount: number;
  productCount: number;
  version: number;
  updatedAt: string;
};

export type TenantTaxRateListQuery = {
  includeArchived?: boolean;
};

export type CreateTenantTaxRateRequest = {
  name: string;
  /** Fraction: "0.18" for 18%. */
  rate: string;
  displayOrder?: number;
};

export type UpdateTenantTaxRateRequest = {
  name?: string;
  rate?: string;
  displayOrder?: number;
  archived?: boolean;
  expectedVersion: number;
};
