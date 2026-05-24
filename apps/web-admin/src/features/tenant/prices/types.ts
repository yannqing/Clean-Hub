export type PriceBusinessLine =
  | "laundry"
  | "dry_cleaning"
  | "pressing"
  | "car_wash"
  | "retail_products";

export type PriceBookStatus = "active" | "disabled" | "draft";

export type PriceBookSummary = {
  id: string;
  businessLine: PriceBusinessLine;
  name: string;
  currency: string;
  status: PriceBookStatus;
  branchId: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  sortOrder: number;
  updatedAt: string;
};

export type PriceBookFormValues = {
  businessLine: PriceBusinessLine;
  name: string;
  currency: string;
  status: PriceBookStatus;
  branchId: string;
  effectiveFrom: string;
  effectiveTo: string;
  sortOrder: number;
};

export type PriceBookListFilters = {
  businessLine?: PriceBusinessLine;
  status?: PriceBookStatus;
  q?: string;
};
