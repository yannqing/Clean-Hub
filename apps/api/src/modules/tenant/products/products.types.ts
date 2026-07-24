export type TenantProductStatus = "active" | "inactive";

export type TenantProductPriceRange = {
  currency: string;
  minAmount: string;
  maxAmount: string;
};

export type TenantProductSummary = {
  id: string;
  name: string;
  brand: string | null;
  categoryId: string | null;
  categoryName: string | null;
  status: TenantProductStatus;
  skuCount: number;
  activeSkuCount: number;
  trackedSkuCount: number;
  primarySkuCode: string | null;
  primaryBarcode: string | null;
  skuCodes: string[];
  barcodes: string[];
  priceRanges: TenantProductPriceRange[];
  onHandQuantity: string;
  reservedQuantity: string;
  lowStockSkuCount: number;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type TenantProductListQuery = {
  status?: TenantProductStatus;
  createdAfter?: string;
  createdBefore?: string;
  limit: number;
  offset: number;
};

export type TenantProductListResponse = {
  data: TenantProductSummary[];
  total: number;
};

export type TenantProductOverviewQuery = {
  createdAfter?: string;
  createdBefore?: string;
};

export type TenantProductOverview = {
  productCount: number;
  activeProductCount: number;
  skuCount: number;
  lowStockSkuCount: number;
};

export type TenantProductRepositoryScope = {
  tenantId: string;
  allowedBranchIds?: string[];
};
