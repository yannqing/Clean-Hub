export type ServiceBusinessLine =
  | "laundry"
  | "car_wash"
  | "retail"
  | "delivery";

export type ServicePricingUnit = "per_item" | "per_kg";
export type ServiceStatus = "active" | "inactive";
export type ServiceLabelRule =
  | "none"
  | "per_item"
  | "per_order_item"
  | "per_bag";

export type ServiceFormErrorCode =
  | "businessLineInvalid"
  | "nameRequired"
  | "nameTooLong"
  | "codeInvalid"
  | "codeDuplicate"
  | "shortNameTooLong"
  | "categoryRequired"
  | "categoryInvalid"
  | "descriptionTooLong"
  | "internalNotesTooLong"
  | "turnaroundMinutesInvalid"
  | "displayOrderInvalid"
  | "pricingUnitInvalid"
  | "labelRuleInvalid"
  | "standardPriceInvalid"
  | "compareAtPriceInvalid"
  | "costPriceInvalid"
  | "currencyInvalid"
  | "statusInvalid"
  | "versionRequired";

export type ServiceSummary = {
  id: string;
  businessLine: ServiceBusinessLine;
  name: string;
  code: string | null;
  shortName: string | null;
  categoryId: string;
  categoryName: string;
  description: string | null;
  internalNotes: string | null;
  turnaroundMinutes: number | null;
  displayOrder: number;
  pricingUnit: ServicePricingUnit;
  labelRule: ServiceLabelRule;
  standardPrice: string;
  compareAtPrice: string | null;
  costPrice: string | null;
  currency: string;
  status: ServiceStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type ServiceCategorySummary = {
  id: string;
  name: string;
  businessLine: ServiceBusinessLine;
  description: string | null;
  sortOrder: number;
  status: ServiceStatus;
};

export type ServiceFormValues = {
  businessLine: ServiceBusinessLine;
  name: string;
  code: string;
  shortName: string;
  categoryId: string;
  description: string;
  internalNotes: string;
  turnaroundMinutes: string;
  displayOrder: string;
  pricingUnit: ServicePricingUnit;
  labelRule: ServiceLabelRule;
  standardPrice: string;
  compareAtPrice: string;
  costPrice: string;
  currency: string;
  status: ServiceStatus;
  /**
   * Optimistic-concurrency version captured when a service is loaded for
   * editing. Required for updates; ignored on create.
   */
  version: number;
};

export type ServiceFormErrors = Partial<
  Record<keyof ServiceFormValues, ServiceFormErrorCode | string>
>;

export type ServiceListFilters = {
  businessLine?: ServiceBusinessLine;
  status?: ServiceStatus;
  q?: string;
};

export type ServiceCategoryListFilters = {
  businessLine?: ServiceBusinessLine;
  status?: ServiceStatus;
};
