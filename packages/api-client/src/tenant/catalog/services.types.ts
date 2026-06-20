export type ServicePricingUnit = "per_item" | "per_kg";
export type ServiceStatus = "active" | "inactive";
export type ServiceBusinessLine =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

export type ServiceSummary = {
  id: string;
  businessLine: ServiceBusinessLine;
  name: string;
  categoryId: string | null;
  pricingUnit: ServicePricingUnit;
  status: ServiceStatus;
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

export type UpdateServiceStatusRequest = {
  status: ServiceStatus;
};

export type ServiceListQuery = {
  businessLine?: ServiceBusinessLine;
  status?: ServiceStatus;
  q?: string;
  limit?: number;
  offset?: number;
};
