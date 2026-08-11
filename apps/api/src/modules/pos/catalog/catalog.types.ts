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
  turnaroundMinutes: number | null;
  amount: string;
  currency: string;
};

export type PosCatalogProduct = {
  id: string;
  productId: string;
  productSkuId: string;
  productPriceId: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  sku: string;
  barcode: string | null;
  variantName: string | null;
  unitOfMeasure: string;
  unitCostAmount: string | null;
  amount: string;
  currency: string;
  trackInventory: boolean;
  availableQuantity: string | null;
  allowNegativeStock: boolean;
  allowOfflineSale: boolean;
  offlineStockBuffer: string;
};

export type PosCatalogQuery = {
  branchId?: string;
  businessLine?: PosCatalogBusinessLine;
  q?: string;
  includeAll?: true;
  limit: number;
};

export type PosCatalogListInput = {
  authContext: AuthContext;
  query: PosCatalogQuery;
};
