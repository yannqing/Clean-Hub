export type DiscountMethod = "code" | "automatic";

export type DiscountType =
  | "amount_off_items"
  | "buy_x_get_y"
  | "amount_off_order"
  | "free_shipping";

export type DiscountDerivedStatus =
  | "active"
  | "scheduled"
  | "expired"
  | "inactive";

export type DiscountValueType = "percentage" | "fixed_amount" | "free";

export type Eligibility = "all_customers" | "specific_customers";

export type MinimumRequirement = "none" | "minimum_amount" | "minimum_quantity";

export type PurchaseRequirement = "minimum_amount" | "minimum_quantity";

export type TargetRole = "applies_to" | "customer_buys" | "customer_gets";

export type TargetType =
  | "product"
  | "product_category"
  | "service"
  | "service_category";

export type CountryScope = "all" | "selected";

export type TenantDiscountSort =
  | "created_desc"
  | "created_asc"
  | "updated_desc"
  | "title_asc"
  | "title_desc"
  | "starts_at_desc"
  | "usage_desc";

export type TenantDiscountTargetInput = {
  role: TargetRole;
  targetType: TargetType;
  targetId: string;
};

export type TenantDiscountTarget = TenantDiscountTargetInput;

export type TenantDiscountChannels = {
  posEnabled: boolean;
  customerMobileEnabled: boolean;
  deliveryEnabled: boolean;
};

/** Normalized form payload shared by create and partial update requests. */
export type TenantDiscountWriteRequest = {
  title: string;
  method: DiscountMethod;
  code?: string | null;
  type: DiscountType;
  enabled?: boolean;
  valueType: DiscountValueType;
  valueAmount?: string | null;
  currency?: string | null;
  eligibility?: Eligibility;
  minimumRequirement?: MinimumRequirement;
  minimumPurchaseAmount?: string | null;
  minimumQuantity?: string | null;
  usageLimit?: number | null;
  oncePerCustomer?: boolean;
  combinesWithItemDiscounts?: boolean;
  combinesWithOrderDiscounts?: boolean;
  combinesWithShippingDiscounts?: boolean;
  startsAt: string;
  endsAt?: string | null;
  allBranches?: boolean;
  branchIds?: string[];
  channels: TenantDiscountChannels;
  buyRequirementType?: PurchaseRequirement | null;
  buyRequirementValue?: string | null;
  getQuantity?: string | null;
  maxUsesPerOrder?: number | null;
  countryScope?: CountryScope;
  countryCodes?: string[];
  maximumShippingPrice?: string | null;
  tags?: string[];
  customerIds?: string[];
  targets?: TenantDiscountTargetInput[];
};

export type CreateTenantDiscountRequest = TenantDiscountWriteRequest;

export type UpdateTenantDiscountRequest = Partial<
  Omit<TenantDiscountWriteRequest, "type">
> & {
  /** Optimistic-concurrency version from the detail last read. */
  version: number;
};

export type TenantDiscountSummary = {
  id: string;
  title: string;
  code: string | null;
  method: DiscountMethod;
  type: DiscountType;
  status: DiscountDerivedStatus;
  enabled: boolean;
  valueType: DiscountValueType;
  valueAmount: string | null;
  currency: string | null;
  startsAt: string;
  endsAt: string | null;
  usageCount: number;
  usageLimit: number | null;
  oncePerCustomer: boolean;
  combinesWithItemDiscounts: boolean;
  combinesWithOrderDiscounts: boolean;
  combinesWithShippingDiscounts: boolean;
  allBranches: boolean;
  branchCount: number;
  posEnabled: boolean;
  updatedAt: string;
  version: number;
  canManage: boolean;
};

export type TenantDiscountListQuery = {
  q?: string;
  status?: DiscountDerivedStatus;
  method?: DiscountMethod;
  type?: DiscountType;
  branchId?: string;
  sort?: TenantDiscountSort;
  limit?: number;
  offset?: number;
};

export type TenantDiscountListResponse = {
  data: TenantDiscountSummary[];
  total: number;
  limit: number;
  offset: number;
};

export type TenantDiscountOverview = {
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

export type TenantDiscountDetail = TenantDiscountSummary & {
  tenantId: string;
  eligibility: Eligibility;
  minimumRequirement: MinimumRequirement;
  minimumPurchaseAmount: string | null;
  minimumQuantity: string | null;
  customerMobileEnabled: boolean;
  deliveryEnabled: boolean;
  buyRequirementType: PurchaseRequirement | null;
  buyRequirementValue: string | null;
  getQuantity: string | null;
  maxUsesPerOrder: number | null;
  countryScope: CountryScope;
  countryCodes: string[];
  maximumShippingPrice: string | null;
  tags: string[];
  branchIds: string[];
  customerIds: string[];
  targets: TenantDiscountTarget[];
  createdAt: string;
  createdBy: string | null;
  updatedBy: string | null;
};

export type TenantDiscountBranchOption = {
  id: string;
  name: string;
  currency: string;
};

export type TenantDiscountNamedOption = {
  id: string;
  name: string;
};

export type TenantDiscountCustomerOption = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
};

export type TenantDiscountBusinessLine =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

export type TenantDiscountServiceOption = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  businessLine: TenantDiscountBusinessLine;
};

export type TenantDiscountServiceCategoryOption = {
  id: string;
  name: string;
  businessLine: TenantDiscountBusinessLine;
};

export type TenantDiscountOptions = {
  defaultCurrency: string;
  branches: TenantDiscountBranchOption[];
  products: TenantDiscountNamedOption[];
  productCategories: TenantDiscountNamedOption[];
  services: TenantDiscountServiceOption[];
  serviceCategories: TenantDiscountServiceCategoryOption[];
  customers: TenantDiscountCustomerOption[];
  currencies: string[];
  timezone: string;
  canManage: boolean;
  canManageAllBranches: boolean;
};

export type TenantDiscountListOptions = Pick<
  TenantDiscountOptions,
  "branches" | "canManage" | "canManageAllBranches"
>;

export type UpdateTenantDiscountStatusRequest = {
  enabled: boolean;
  /** Optimistic-concurrency version from the record last read. */
  version: number;
};

export type DeleteTenantDiscountRequest = {
  /** Optimistic-concurrency version from the record last read. */
  version: number;
};
