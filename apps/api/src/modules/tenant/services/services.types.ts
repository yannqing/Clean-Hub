import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type ServiceBusinessLine =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

export type ServicePricingUnit = "per_item" | "per_kg";
export type ServiceStatus = "active" | "inactive";
export type ServiceLabelRule =
  | "none"
  | "per_item"
  | "per_order_item"
  | "per_bag";

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
  categoryId: string;
  categoryName: string;
  description: string | null;
  displayOrder: number;
  pricingUnit: ServicePricingUnit;
  labelRule: ServiceLabelRule;
  standardPrice: string;
  currency: string;
  status: ServiceStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CreateServiceRequest = {
  businessLine: ServiceBusinessLine;
  name: string;
  categoryId: string;
  description?: string | null;
  displayOrder?: number;
  pricingUnit: ServicePricingUnit;
  labelRule: ServiceLabelRule;
  standardPrice: string;
  status?: ServiceStatus;
};

export type UpdateServiceRequest = Partial<
  CreateServiceRequest & { currency: string }
> & {
  /** Optimistic-concurrency version from the record the editor last read. */
  version: number;
};

export type TenantServiceInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};

export type ServiceAuditSnapshot = {
  tenantId: string;
  businessLine: ServiceBusinessLine;
  name: string;
  categoryId: string;
  categoryName: string;
  description: string | null;
  displayOrder: number;
  pricingUnit: ServicePricingUnit;
  labelRule: ServiceLabelRule;
  standardPrice: string;
  currency: string;
  status: ServiceStatus;
};

export type ServicePriceAuditSnapshot = {
  id: string;
  tenantId: string;
  serviceId: string;
  serviceName: string;
  businessLine: ServiceBusinessLine;
  amount: string;
  currency: string;
  status: ServiceStatus;
};
