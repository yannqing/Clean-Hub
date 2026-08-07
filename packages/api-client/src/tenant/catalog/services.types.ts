export type ServicePricingUnit = "per_item" | "per_kg";
export type ServiceStatus = "active" | "inactive";
export type ServiceLabelRule =
  | "none"
  | "per_item"
  | "per_order_item"
  | "per_bag";
export type ServiceBusinessLine =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

export type ServiceSummary = {
  id: string;
  businessLine: ServiceBusinessLine;
  name: string;
  code: string | null;
  shortName: string | null;
  categoryId: string;
  categoryName: string;
  description: string | null;
  internalNotes: string | null;
  turnaroundMinutes: number | null;
  displayOrder: number;
  pricingUnit: ServicePricingUnit;
  labelRule: ServiceLabelRule;
  standardPrice: string;
  compareAtPrice: string | null;
  costPrice: string | null;
  currency: string;
  status: ServiceStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CreateServiceRequest = {
  businessLine: ServiceBusinessLine;
  name: string;
  code?: string | null;
  shortName?: string | null;
  categoryId: string;
  description?: string | null;
  internalNotes?: string | null;
  turnaroundMinutes?: number | null;
  displayOrder?: number;
  pricingUnit: ServicePricingUnit;
  labelRule: ServiceLabelRule;
  standardPrice: string;
  compareAtPrice?: string | null;
  costPrice?: string | null;
  status?: ServiceStatus;
};

export type UpdateServiceRequest = Partial<CreateServiceRequest> & {
  /** Optimistic-concurrency version from the record the editor last read. */
  version: number;
};

export type UpdateServiceStatusRequest = {
  status: ServiceStatus;
  /** Optimistic-concurrency version from the record the editor last read. */
  version: number;
};

export type ServiceListQuery = {
  businessLine?: ServiceBusinessLine;
  status?: ServiceStatus;
  q?: string;
  limit?: number;
  offset?: number;
};

export type ServiceCategorySummary = {
  id: string;
  name: string;
  businessLine: ServiceBusinessLine;
  description: string | null;
  sortOrder: number;
  status: ServiceStatus;
};

export type ServiceCategoryListQuery = {
  businessLine?: ServiceBusinessLine;
  status?: ServiceStatus;
  limit?: number;
  offset?: number;
};
