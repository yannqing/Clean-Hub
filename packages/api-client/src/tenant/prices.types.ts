export type PriceBookStatus = "active" | "disabled" | "draft";

export type PriceBookSummary = {
  id: string;
  name: string;
  currency: string;
  status: PriceBookStatus;
};
