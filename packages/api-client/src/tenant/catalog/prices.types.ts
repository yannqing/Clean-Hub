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

export type UpdatePriceRequest = {
  amount?: string;
  currency?: string;
  status?: PriceStatus;
  /** Optimistic-concurrency version from the record the editor last read. */
  version: number;
};

export type PriceListQuery = {
  businessLine?: PriceBusinessLine;
  status?: PriceStatus;
  q?: string;
  limit?: number;
  offset?: number;
};
