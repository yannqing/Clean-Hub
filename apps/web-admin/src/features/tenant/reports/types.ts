export type ReportSummary = {
  currency: string;
  timezone: string;
  availableCurrencies: string[];
  grossSales: number;
  taxableAmount: number;
  taxAmount: number;
  taxComponents: Array<{ name: string; rate: string; taxableAmount: number; taxAmount: number }>;
  orderCount: number;
  averageOrderValue: number;
  uniqueCustomerCount: number;
  pendingPickupCount: number;
  inProgressCount: number;
  overdueCount: number;
  comparison: {
    grossSales: number;
    orderCount: number;
    averageOrderValue: number;
    uniqueCustomerCount: number;
  } | null;
  changes: {
    grossSales: number | null;
    orderCount: number | null;
    averageOrderValue: number | null;
    uniqueCustomerCount: number | null;
  };
  paymentBreakdown: {
    cash: number;
    mobile: number;
    card: number;
    other: number;
  };
  orderStatusBreakdown: {
    draft: number;
    received: number;
    paid: number;
    delivered: number;
    cancelled: number;
  };
  salesTrend: Array<{
    date: string;
    grossSales: number;
    orderCount: number;
  }>;
  branchPerformance: Array<{
    branchId: string;
    branchName: string;
    grossSales: number;
    orderCount: number;
  }>;
  availableBranches: Array<{
    id: string;
    name: string;
  }>;
  filters: {
    from: string | null;
    to: string | null;
    branchId: string | null;
  };
  generatedAt: string;
};

export type ReportSummaryQuery = {
  from?: string;
  to?: string;
  branchId?: string;
  currency?: string;
};
