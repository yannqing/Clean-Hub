export type ServiceBusinessLine =
  | "laundry"
  | "dry_cleaning"
  | "pressing"
  | "car_wash"
  | "retail_products";

export type ServicePricingMode = "per_item" | "per_kg";
export type ServiceStatus = "active" | "disabled";

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

export type ServiceFormValues = {
  businessLine: ServiceBusinessLine;
  name: string;
  category: string;
  description: string;
  pricingMode: ServicePricingMode;
  status: ServiceStatus;
  sortOrder: number;
};

export type ServiceListFilters = {
  businessLine?: ServiceBusinessLine;
  status?: ServiceStatus;
  q?: string;
};
