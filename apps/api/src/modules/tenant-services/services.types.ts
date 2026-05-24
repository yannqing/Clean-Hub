import type { AuthContext, AuthRequestMeta } from "../auth/auth.types.js";

export type ServiceBusinessLine =
  | "laundry"
  | "dry_cleaning"
  | "pressing"
  | "car_wash"
  | "retail_products";

export type ServicePricingMode = "per_item" | "per_kg";
export type ServiceStatus = "active" | "disabled";

export type ServiceListInput = {
  businessLine?: ServiceBusinessLine;
  status?: ServiceStatus;
  q?: string;
  limit: number;
  offset: number;
};

export type ServiceSummary = {
  id: string;
  tenantId: string;
  businessLine: ServiceBusinessLine;
  name: string;
  category: string | null;
  description: string | null;
  pricingMode: ServicePricingMode;
  status: ServiceStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CreateServiceRequest = {
  businessLine: ServiceBusinessLine;
  name: string;
  category?: string | null;
  description?: string | null;
  pricingMode: ServicePricingMode;
  status?: ServiceStatus;
  sortOrder?: number;
};

export type UpdateServiceRequest = Partial<CreateServiceRequest>;

export type TenantServiceInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};

export type ServiceAuditSnapshot = {
  tenantId: string;
  businessLine: ServiceBusinessLine;
  name: string;
  category: string | null;
  description: string | null;
  pricingMode: ServicePricingMode;
  status: ServiceStatus;
  sortOrder: number;
};
