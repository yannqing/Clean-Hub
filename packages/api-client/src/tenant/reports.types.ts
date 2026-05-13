export type ReportSummary = {
  grossSales: number;
  orderCount: number;
  pendingPickupCount?: number;
  inProgressCount?: number;
  paymentBreakdown?: Record<string, number>;
};
