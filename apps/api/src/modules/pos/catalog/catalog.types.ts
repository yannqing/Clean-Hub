import type { AuthContext } from "../../auth/auth.types.js";

export type PosCatalogBusinessLine =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

export type PosCatalogPricingUnit = "per_item" | "per_kg";
export type PosCatalogLabelRule =
  | "none"
  | "per_item"
  | "per_order_item"
  | "per_bag";

export type PosCatalogService = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  businessLine: PosCatalogBusinessLine;
  pricingUnit: PosCatalogPricingUnit;
  labelRule: PosCatalogLabelRule;
  amount: string;
  currency: string;
};

export type PosCatalogQuery = {
  branchId?: string;
  businessLine?: PosCatalogBusinessLine;
  q?: string;
  limit: number;
};

export type PosCatalogListInput = {
  authContext: AuthContext;
  query: PosCatalogQuery;
};
