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
  /**
   * Optimistic-concurrency version captured when a price is loaded for
   * editing. Required for updates.
   */
  version: number;
};

export type PriceListFilters = {
  businessLine?: PriceBusinessLine;
  status?: PriceStatus;
  q?: string;
};
