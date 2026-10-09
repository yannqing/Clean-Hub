import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type TenantTaxRate = {
  id: string;
  name: string;
  /** Fraction: "0.1800" is 18%. */
  rate: string;
  displayOrder: number;
  archived: boolean;
  /** How many live services and products are assigned this rate. */
  serviceCount: number;
  productCount: number;
  version: number;
  updatedAt: string;
};

export type TenantTaxRateListQuery = {
  includeArchived: boolean;
};

export type CreateTenantTaxRateRequest = {
  name: string;
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

export type TenantTaxRateRequestInput<TData> = {
  authContext: AuthContext;
  data: TData;
  requestMeta?: AuthRequestMeta;
};
