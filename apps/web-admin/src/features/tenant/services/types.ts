export type ServiceBusinessLine =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

export type ServicePricingUnit = "per_item" | "per_kg";
export type ServiceStatus = "active" | "inactive";

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

export type ServiceFormValues = {
  businessLine: ServiceBusinessLine;
  name: string;
  categoryId: string;
  pricingUnit: ServicePricingUnit;
  status: ServiceStatus;
};

export type ServiceListFilters = {
  businessLine?: ServiceBusinessLine;
  status?: ServiceStatus;
  q?: string;
};
