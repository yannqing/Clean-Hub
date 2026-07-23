export type PosCatalogBusinessLine =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

export type PosCatalogPricingUnit = "per_item" | "per_kg";

export type PosCatalogService = {
  id: string;
  name: string;
  categoryId: string | null;
  businessLine: PosCatalogBusinessLine;
  pricingUnit: PosCatalogPricingUnit;
  amount: string;
  currency: string;
};

export type PosCatalogQuery = {
  branchId?: string;
  businessLine?: PosCatalogBusinessLine;
  q?: string;
  limit?: number;
};

export type PosCatalogResponse = {
  data: PosCatalogService[];
};
