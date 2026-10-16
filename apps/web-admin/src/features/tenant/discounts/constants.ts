import type {
  DiscountDerivedStatus,
  DiscountMethod,
  DiscountType,
  TenantDiscountSort,
} from "./types";

export const DISCOUNT_PAGE_SIZE = 10;

export const DISCOUNT_TYPES: DiscountType[] = [
  "amount_off_items",
  "amount_off_order",
  "buy_x_get_y",
  "free_shipping",
];

export const DISCOUNT_METHODS: DiscountMethod[] = ["code", "automatic"];

export const DISCOUNT_STATUSES: DiscountDerivedStatus[] = [
  "active",
  "scheduled",
  "expired",
  "inactive",
];

export const DISCOUNT_SORTS: TenantDiscountSort[] = [
  "created_desc",
  "created_asc",
  "updated_desc",
  "title_asc",
  "title_desc",
  "starts_at_desc",
  "usage_desc",
];
