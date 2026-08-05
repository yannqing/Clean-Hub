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

export type UpdateTenantProductBranchSetting = {
  branchId: string;
  expectedStockOnHand: string;
  stockOnHand: string;
  reorderPoint: string;
};

export type UpdateTenantProductRequest = Omit<
  CreateTenantProductRequest,
  "branchSettings" | "mediaObjectKeys"
> & {
  version: number;
  skuId: string;
  skuVersion: number;
  branchSettings: UpdateTenantProductBranchSetting[];
  retainedMediaIds: string[];
  newMediaObjectKeys: string[];
};

export type TenantProductDetailSku = {
  id: string;
  version: number;
  skuCode: string;
  barcode: string | null;
  variantName: string | null;
  unitOfMeasure: string;
  unitsPerSale: string;
  trackInventory: boolean;
  referenceCost: string | null;
  referenceCostCurrency: string | null;
};

export type TenantProductDetailBranchSetting = {
  branchId: string;
  isAvailable: boolean;
  reorderPoint: string;
  onHandQuantity: string;
  reservedQuantity: string;
  allowNegativeStock: boolean;
  allowOfflineSale: boolean;
};

export type TenantProductDetailMedia = {
  id: string;
  objectKey: string;
  downloadUrl: string;
  expiresAt: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type TenantProductDetail = {
  id: string;
  version: number;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  brand: string | null;
  description: string | null;
  tags: string[];
  status: TenantProductStatus;
  skuCount: number;
  sku: TenantProductDetailSku;
  salePrice: string;
  currency: string;
  branchSettings: TenantProductDetailBranchSetting[];
  categoryAttributes: CreateTenantProductCategoryAttribute[];
  media: TenantProductDetailMedia[];
};

export type UpdateTenantProductResponse = {
  id: string;
  version: number;
  skuVersion: number;
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

export type RequestTenantProductMediaDownloads = {
  items: Array<{
    productId: string;
    mediaId: string;
  }>;
};

export type TenantProductMediaDownload = {
  productId: string;
  mediaId: string;
  downloadUrl: string;
  expiresAt: string;
};

export type TenantProductMediaDownloadListResponse = {
  data: TenantProductMediaDownload[];
};

export type TenantProductPriceRange = {
  currency: string;
  minAmount: string;
  maxAmount: string;
};

export type TenantProductSummaryImage = {
  id: string;
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
  primaryImage: TenantProductSummaryImage | null;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type TenantProductListQuery = {
  q?: string;
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
