export type ServicePricingMode = "per_item" | "per_kg";
export type ServiceStatus = "active" | "disabled";
export type ServiceBusinessLine = "laundry" | "dry_cleaning" | "pressing" | "car_wash" | "retail_products";

export type ServiceSummary = {
  id: string;
  businessLine: ServiceBusinessLine;
  name: string;
  category: string | null;
  description: string | null;
  pricingMode: ServicePricingMode;
  status: ServiceStatus;
  sortOrder: number;
  updatedAt: string;
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
