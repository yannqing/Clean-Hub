import type {
  CountryScope,
  CreateTenantDiscountRequest,
  DiscountDerivedStatus,
  DiscountMethod,
  DiscountType,
  DiscountValueType,
  Eligibility,
  MinimumRequirement,
  PurchaseRequirement,
  TargetRole,
  TargetType,
  TenantDiscountBranchOption,
  TenantDiscountChannels,
  TenantDiscountCustomerOption,
  TenantDiscountDetail,
  TenantDiscountListOptions,
  TenantDiscountListQuery,
  TenantDiscountListResponse,
  TenantDiscountNamedOption,
  TenantDiscountOptions,
  TenantDiscountOverview,
  TenantDiscountServiceCategoryOption,
  TenantDiscountServiceOption,
  TenantDiscountSort,
  TenantDiscountSummary,
  TenantDiscountTarget,
  TenantDiscountTargetInput,
  UpdateTenantDiscountRequest,
} from "@cleanhub/api-client";

export type {
  CountryScope,
  CreateTenantDiscountRequest,
  DiscountDerivedStatus,
  DiscountMethod,
  DiscountType,
  DiscountValueType,
  Eligibility,
  MinimumRequirement,
  PurchaseRequirement,
  TargetRole,
  TargetType,
  TenantDiscountBranchOption,
  TenantDiscountChannels,
  TenantDiscountCustomerOption,
  TenantDiscountDetail,
  TenantDiscountListOptions,
  TenantDiscountListQuery,
  TenantDiscountListResponse,
  TenantDiscountNamedOption,
  TenantDiscountOptions,
  TenantDiscountOverview,
  TenantDiscountServiceCategoryOption,
  TenantDiscountServiceOption,
  TenantDiscountSort,
  TenantDiscountSummary,
  TenantDiscountTarget,
  TenantDiscountTargetInput,
  UpdateTenantDiscountRequest,
};

export type DiscountTargetScope = "all" | "specific";

export type DiscountFormValues = {
  title: string;
  method: DiscountMethod;
  code: string;
  type: DiscountType;
  enabled: boolean;
  valueType: DiscountValueType;
  valueAmount: string;
  currency: string;
  targetScope: DiscountTargetScope;
  targets: TenantDiscountTargetInput[];
  eligibility: Eligibility;
  customerIds: string[];
  minimumRequirement: MinimumRequirement;
  minimumPurchaseAmount: string;
  minimumQuantity: string;
  usageLimit: string;
  oncePerCustomer: boolean;
  combinesWithItemDiscounts: boolean;
  combinesWithOrderDiscounts: boolean;
  combinesWithShippingDiscounts: boolean;
  startsAt: string;
  hasEndDate: boolean;
  endsAt: string;
  allBranches: boolean;
  branchIds: string[];
  posEnabled: boolean;
  customerMobileEnabled: boolean;
  deliveryEnabled: boolean;
  buyRequirementType: PurchaseRequirement;
  buyRequirementValue: string;
  getQuantity: string;
  maxUsesPerOrder: string;
  countryScope: CountryScope;
  countryCodesInput: string;
  maximumShippingPrice: string;
  tagsInput: string;
};

export type DiscountFormField = keyof DiscountFormValues;

export type DiscountFormErrorCode =
  | "titleRequired"
  | "titleTooLong"
  | "codeRequired"
  | "codeInvalid"
  | "valueInvalid"
  | "currencyRequired"
  | "minimumInvalid"
  | "usageLimitInvalid"
  | "customersRequired"
  | "targetsRequired"
  | "branchesRequired"
  | "buyRequirementInvalid"
  | "getQuantityInvalid"
  | "maxUsesPerOrderInvalid"
  | "datesInvalid"
  | "countriesRequired"
  | "shippingPriceInvalid"
  | "tagsInvalid"
  | "serverInvalid";

export type DiscountFormErrors = Partial<
  Record<DiscountFormField, DiscountFormErrorCode>
>;

export type DiscountSelectableTarget = {
  id: string;
  name: string;
  targetType: TargetType;
  detail?: string;
};
