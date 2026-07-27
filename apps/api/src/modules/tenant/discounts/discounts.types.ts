import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

export type DiscountMethod = "code" | "automatic";
export type DiscountType =
  | "amount_off_items"
  | "buy_x_get_y"
  | "amount_off_order"
  | "free_shipping";
export type DiscountValueType = "percentage" | "fixed_amount" | "free";
export type DiscountEligibility = "all_customers" | "specific_customers";
export type DiscountMinimumRequirement =
  | "none"
  | "minimum_amount"
  | "minimum_quantity";
export type DiscountPurchaseRequirement = "minimum_amount" | "minimum_quantity";
export type DiscountTargetRole =
  | "applies_to"
  | "customer_buys"
  | "customer_gets";
export type DiscountTargetType =
  | "product"
  | "product_category"
  | "service"
  | "service_category";
export type DiscountCountryScope = "all" | "selected";
export type DiscountDerivedStatus =
  | "active"
  | "scheduled"
  | "expired"
  | "inactive";
export type DiscountListSort =
  | "created_desc"
  | "created_asc"
  | "updated_desc"
  | "title_asc"
  | "title_desc"
  | "starts_at_desc"
  | "usage_desc";

export type DiscountTargetInput = {
  role: DiscountTargetRole;
  targetType: DiscountTargetType;
  targetId: string;
};

export type DiscountChannelsInput = {
  posEnabled: boolean;
  customerMobileEnabled: boolean;
  deliveryEnabled: boolean;
};

export type CreateDiscountRequest = {
  title: string;
  method: DiscountMethod;
  type: DiscountType;
  enabled: boolean;
  code: string | null;
  valueType: DiscountValueType;
  valueAmount: string | null;
  currency: string | null;
  eligibility: DiscountEligibility;
  minimumRequirement: DiscountMinimumRequirement;
  minimumPurchaseAmount: string | null;
  minimumQuantity: string | null;
  usageLimit: number | null;
  oncePerCustomer: boolean;
  combinesWithItemDiscounts: boolean;
  combinesWithOrderDiscounts: boolean;
  combinesWithShippingDiscounts: boolean;
  startsAt: string;
  endsAt: string | null;
  allBranches: boolean;
  branchIds: string[];
  channels: DiscountChannelsInput;
  buyRequirementType: DiscountPurchaseRequirement | null;
  buyRequirementValue: string | null;
  getQuantity: string | null;
  maxUsesPerOrder: number | null;
  countryScope: DiscountCountryScope;
  countryCodes: string[];
  maximumShippingPrice: string | null;
  tags: string[];
  targets: DiscountTargetInput[];
  customerIds: string[];
};

export type UpdateDiscountRequest = Partial<
  Omit<CreateDiscountRequest, "type">
> & {
  version: number;
};

export type UpdateDiscountStatusRequest = {
  enabled: boolean;
  version: number;
};

export type DeleteDiscountRequest = {
  version: number;
};

export type DiscountListQuery = {
  status?: DiscountDerivedStatus;
  method?: DiscountMethod;
  type?: DiscountType;
  branchId?: string;
  q?: string;
  sort: DiscountListSort;
  limit: number;
  offset: number;
};

export type DiscountSummary = {
  id: string;
  title: string;
  method: DiscountMethod;
  type: DiscountType;
  status: DiscountDerivedStatus;
  enabled: boolean;
  code: string | null;
  valueType: DiscountValueType;
  valueAmount: string | null;
  currency: string | null;
  startsAt: string;
  endsAt: string | null;
  allBranches: boolean;
  branchCount: number;
  usageCount: number;
  usageLimit: number | null;
  oncePerCustomer: boolean;
  combinesWithItemDiscounts: boolean;
  combinesWithOrderDiscounts: boolean;
  combinesWithShippingDiscounts: boolean;
  posEnabled: boolean;
  updatedAt: string;
  version: number;
  canManage: boolean;
};

export type DiscountDetail = DiscountSummary & {
  tenantId: string;
  eligibility: DiscountEligibility;
  minimumRequirement: DiscountMinimumRequirement;
  minimumPurchaseAmount: string | null;
  minimumQuantity: string | null;
  customerMobileEnabled: boolean;
  deliveryEnabled: boolean;
  buyRequirementType: DiscountPurchaseRequirement | null;
  buyRequirementValue: string | null;
  getQuantity: string | null;
  maxUsesPerOrder: number | null;
  countryScope: DiscountCountryScope;
  countryCodes: string[];
  maximumShippingPrice: string | null;
  tags: string[];
  branchIds: string[];
  targets: DiscountTargetInput[];
  customerIds: string[];
  createdAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type DiscountListResponse = {
  data: DiscountSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type DiscountOverview = {
  total: number;
  active: number;
  scheduled: number;
  expired: number;
  inactive: number;
  codeDiscounts: number;
  automaticDiscounts: number;
  totalUses: number;
  savingsByCurrency: Array<{
    currency: string;
    amount: string;
  }>;
};

export type DiscountOptions = {
  branches: Array<{ id: string; name: string; currency: string }>;
  products: Array<{ id: string; name: string }>;
  productCategories: Array<{ id: string; name: string }>;
  services: Array<{
    id: string;
    name: string;
    categoryId: string;
    categoryName: string;
    businessLine: "laundry" | "car_wash" | "retail" | "delivery";
  }>;
  serviceCategories: Array<{
    id: string;
    name: string;
    businessLine: "laundry" | "car_wash" | "retail" | "delivery";
  }>;
  customers: Array<{
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  }>;
  currencies: string[];
  timezone: string;
  canManage: boolean;
  canManageAllBranches: boolean;
};

export type DiscountListOptions = Pick<
  DiscountOptions,
  "branches" | "canManage" | "canManageAllBranches"
>;

export type DiscountRepositoryScope = {
  tenantId: string;
  allowedBranchIds?: string[];
};

export type DiscountRequestInput<TData> = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: TData;
};

export type DiscountRepositorySummary = Omit<DiscountSummary, "canManage"> & {
  scopeBranchIds: string[];
};

export type DiscountRepositoryDetail = Omit<DiscountDetail, "canManage"> & {
  scopeBranchIds: string[];
};

export type DiscountReferenceValidation = {
  branchIds: Set<string>;
  productIds: Set<string>;
  productCategoryIds: Set<string>;
  serviceIds: Set<string>;
  serviceCategoryIds: Set<string>;
  customerIds: Set<string>;
};
