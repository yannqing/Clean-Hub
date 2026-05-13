export type ServicePricingMode = "per_item" | "per_kg";
export type ServiceStatus = "active" | "disabled";

export type ServiceSummary = {
  id: string;
  name: string;
  category: string;
  pricingMode: ServicePricingMode;
  status: ServiceStatus;
};
