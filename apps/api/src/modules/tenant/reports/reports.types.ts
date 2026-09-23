export type ReportSummaryInput = {
  from?: string;
  to?: string;
  branchId?: string;
  currency?: string;
};

export type PaymentBreakdown = {
  cash: number;
  mobile: number;
  card: number;
  other: number;
};

export type ReportComparisonMetrics = {
  grossSales: number;
  orderCount: number;
  averageOrderValue: number;
  uniqueCustomerCount: number;
};

export type ReportMetricChanges = {
  grossSales: number | null;
  orderCount: number | null;
  averageOrderValue: number | null;
  uniqueCustomerCount: number | null;
};

export type OrderStatusBreakdown = {
  draft: number;
  received: number;
  paid: number;
  delivered: number;
  cancelled: number;
};

export type ReportSalesTrendPoint = {
  date: string;
  grossSales: number;
  orderCount: number;
};

export type ReportBranchPerformance = {
  branchId: string;
  branchName: string;
  grossSales: number;
  orderCount: number;
};

export type ReportAvailableBranch = {
  id: string;
  name: string;
};

export type ReportSummary = {
  currency: string;
  timezone: string;
  availableCurrencies: string[];
  grossSales: number;
  /** Tax on non-cancelled, non-draft orders created in this period. */
  taxableAmount: number;
  taxAmount: number;
  orderCount: number;
  averageOrderValue: number;
  uniqueCustomerCount: number;
  pendingPickupCount: number;
  inProgressCount: number;
  overdueCount: number;
  comparison: ReportComparisonMetrics | null;
  changes: ReportMetricChanges;
  paymentBreakdown: PaymentBreakdown;
  orderStatusBreakdown: OrderStatusBreakdown;
  salesTrend: ReportSalesTrendPoint[];
  branchPerformance: ReportBranchPerformance[];
  availableBranches: ReportAvailableBranch[];
  filters: {
    from: string | null;
    to: string | null;
    branchId: string | null;
  };
  generatedAt: string;
};
