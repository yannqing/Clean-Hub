export type PriceBusinessLine =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

export type PriceStatus = "active" | "inactive";

export type PriceSummary = {
  id: string;
  serviceId: string;
  serviceName: string;
  businessLine: PriceBusinessLine;
  amount: string;
  currency: string;
  status: PriceStatus;
  updatedAt: string;
  version: number;
};

export type PriceFormValues = {
  amount: string;
  currency: string;
  status: PriceStatus;
};

export type PriceListFilters = {
  businessLine?: PriceBusinessLine;
  status?: PriceStatus;
  q?: string;
};
