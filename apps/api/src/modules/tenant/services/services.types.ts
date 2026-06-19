import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type ServiceBusinessLine =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

export type ServicePricingUnit = "per_item" | "per_kg";
export type ServiceStatus = "active" | "inactive";

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
  categoryId: string | null;
  pricingUnit: ServicePricingUnit;
  status: ServiceStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CreateServiceRequest = {
  businessLine: ServiceBusinessLine;
  name: string;
  categoryId?: string | null;
  pricingUnit: ServicePricingUnit;
  status?: ServiceStatus;
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
  categoryId: string | null;
  pricingUnit: ServicePricingUnit;
  status: ServiceStatus;
};
