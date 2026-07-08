import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type PriceBusinessLine =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

export type PriceStatus = "active" | "inactive";

export type PriceListInput = {
  businessLine?: PriceBusinessLine;
  status?: PriceStatus;
  q?: string;
  limit: number;
  offset: number;
};

export type PriceSummary = {
  id: string;
  tenantId: string;
  serviceId: string;
  serviceName: string;
  businessLine: PriceBusinessLine;
  amount: string;
  currency: string;
  status: PriceStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type UpdatePriceRequest = {
  amount?: string;
  currency?: string;
  status?: PriceStatus;
  /** Optimistic-concurrency version from the record the editor last read. */
  version: number;
};

export type TenantPriceInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};

export type PriceAuditSnapshot = {
  tenantId: string;
  serviceId: string;
  serviceName: string;
  businessLine: PriceBusinessLine;
  amount: string;
  currency: string;
  status: PriceStatus;
};
