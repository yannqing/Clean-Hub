export type ReportSummary = {
  grossSales: number;
  orderCount: number;
  pendingPickupCount: number;
  inProgressCount: number;
  paymentBreakdown: {
    cash: number;
    mobile: number;
    card: number;
    other: number;
  };
  filters?: {
    from: string | null;
    to: string | null;
    branchId: string | null;
  };
};
