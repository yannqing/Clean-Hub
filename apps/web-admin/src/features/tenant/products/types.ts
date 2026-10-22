import type {
  CreateTenantProductBranchSetting,
  CreateTenantProductCategoryAttribute,
  CreateTenantProductRequest,
  CreateTenantProductResponse,
  TenantProductCategoryAttributeDefinition,
  TenantProductCategoryAttributeListResponse,
  TenantProductCategoryAttributeOption,
  TenantProductCategoryAttributeValueType,
  TenantProductCategorySummary,
  TenantProductDetail,
  TenantProductStatus,
  UpdateTenantProductRequest,
  UpdateTenantProductResponse,
} from "@cleanhub/api-client";

export type {
  CreateTenantProductBranchSetting,
  CreateTenantProductCategoryAttribute,
  CreateTenantProductRequest,
  CreateTenantProductResponse,
  TenantProductCategoryAttributeDefinition,
  TenantProductCategoryAttributeListResponse,
  TenantProductCategoryAttributeOption,
  TenantProductCategoryAttributeValueType,
  TenantProductCategorySummary,
  TenantProductDetail,
  TenantProductStatus,
  UpdateTenantProductRequest,
  UpdateTenantProductResponse,
};

export type ProductFormValues = {
  name: string;
  categoryId: string;
  categoryAttributes: CreateTenantProductCategoryAttribute[];
  brand: string;
  description: string;
  tags: string[];
  mediaObjectKeys: string[];
  status: string;
  skuCode: string;
  barcode: string;
  variantName: string;
  unitOfMeasure: string;
  unitsPerSale: string;
  salePrice: string;
  currency: string;
  referenceCost: string;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  allowOfflineSale: boolean;
  branchSettings: CreateTenantProductBranchSetting[];
  /** Rate id, or "" for the tenant default. */
  taxRateId: string;
};

export type ProductFormErrorCode =
  | "nameRequired"
  | "taxRateInvalid"
  | "nameTooLong"
  | "categoryInvalid"
  | "categoryAttributeValueRequired"
  | "categoryAttributesInvalid"
  | "tooManyCategoryAttributes"
  | "brandTooLong"
  | "descriptionTooLong"
  | "tooManyTags"
  | "tagTooLong"
  | "tooManyMedia"
  | "mediaInvalid"
  | "statusInvalid"
  | "skuCodeRequired"
  | "skuCodeTooLong"
  | "skuCodeDuplicate"
  | "barcodeTooLong"
  | "barcodeDuplicate"
  | "variantNameTooLong"
  | "unitOfMeasureRequired"
  | "unitOfMeasureTooLong"
  | "unitsPerSaleInvalid"
  | "salePriceInvalid"
  | "currencyInvalid"
  | "referenceCostInvalid"
  | "branchRequired"
  | "branchInvalid"
  | "branchDuplicate"
  | "branchInventoryInvalid"
  | "serverInvalid";

export type ProductFormErrors = Partial<
  Record<keyof ProductFormValues, ProductFormErrorCode>
>;
