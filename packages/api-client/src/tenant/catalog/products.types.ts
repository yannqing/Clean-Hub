export type TenantProductStatus = "active" | "inactive";

export type CreateTenantProductBranchSetting = {
  branchId: string;
  openingStock: string;
  reorderPoint: string;
};

export type CreateTenantProductCategoryAttribute =
  | {
      definitionId: string;
      optionIds: string[];
      textValue?: never;
    }
  | {
      definitionId: string;
      optionIds?: never;
      textValue: string;
    };

export type CreateTenantProductRequest = {
  name: string;
  categoryId?: string;
  categoryName?: string;
  categoryAttributes: CreateTenantProductCategoryAttribute[];
  brand?: string;
  description?: string;
  tags: string[];
  mediaObjectKeys: string[];
  status: TenantProductStatus;
  skuCode: string;
  barcode?: string;
  variantName?: string;
  unitOfMeasure: string;
  unitsPerSale: string;
  salePrice: string;
  currency: string;
  referenceCost?: string | null;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  allowOfflineSale: boolean;
  branchSettings: CreateTenantProductBranchSetting[];
};

export type CreateTenantProductResponse = {
  id: string;
};

export type TenantProductCategorySummary = {
  id: string;
  name: string;
  code: string | null;
};

export type TenantProductCategoryListResponse = {
  data: TenantProductCategorySummary[];
};

export type TenantProductCategoryAttributeValueType =
  | "text"
  | "single_select"
  | "multi_select";

export type TenantProductCategoryAttributeOption = {
  id: string;
  code: string;
  label: string;
  sortOrder: number;
};

export type TenantProductCategoryAttributeDefinition = {
  id: string;
  code: string;
  name: string;
  valueType: TenantProductCategoryAttributeValueType;
  required: boolean;
  sortOrder: number;
  options: TenantProductCategoryAttributeOption[];
};

export type TenantProductCategoryAttributeListResponse = {
  category: {
    id: string;
    name: string;
    code: string | null;
    version: number;
  };
  data: TenantProductCategoryAttributeDefinition[];
};

export type RequestTenantProductMediaUploadRequest = {
  contentType: string;
  sizeBytes: number;
};

export type TenantProductMediaUploadTicket = {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
};

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
  tags: string[];
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
  limit?: number;
  offset?: number;
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
