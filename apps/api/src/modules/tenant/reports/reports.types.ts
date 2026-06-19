export type ReportSummaryInput = {
  from?: string;
  to?: string;
  branchId?: string;
};

export type PaymentBreakdown = {
  cash: number;
  mobile: number;
  card: number;
  other: number;
};

export type ReportSummary = {
  grossSales: number;
  orderCount: number;
  pendingPickupCount: number;
  inProgressCount: number;
  paymentBreakdown: PaymentBreakdown;
  filters: {
    from: string | null;
    to: string | null;
    branchId: string | null;
  };
};
