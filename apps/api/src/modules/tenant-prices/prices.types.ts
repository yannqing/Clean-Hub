import type { AuthContext, AuthRequestMeta } from "../auth/auth.types.js";

export type PriceBusinessLine =
  | "laundry"
  | "dry_cleaning"
  | "pressing"
  | "car_wash"
  | "retail_products";

export type PriceBookStatus = "active" | "disabled" | "draft";

export type PriceBookListInput = {
  businessLine?: PriceBusinessLine;
  status?: PriceBookStatus;
  branchId?: string;
  q?: string;
  limit: number;
  offset: number;
};

export type PriceBookSummary = {
  id: string;
  tenantId: string;
  businessLine: PriceBusinessLine;
  name: string;
  currency: string;
  status: PriceBookStatus;
  branchId: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CreatePriceBookRequest = {
  businessLine: PriceBusinessLine;
  name: string;
  currency: string;
  status?: PriceBookStatus;
  branchId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  sortOrder?: number;
};

export type UpdatePriceBookRequest = Partial<CreatePriceBookRequest>;

export type TenantPriceInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};

export type PriceBookAuditSnapshot = {
  tenantId: string;
  businessLine: PriceBusinessLine;
  name: string;
  currency: string;
  status: PriceBookStatus;
  branchId: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  sortOrder: number;
};
