export type TenantFinanceSummaryQuery = {
  from?: string;
  to?: string;
  branchId?: string;
  currency?: string;
};

export type FinanceAvailableBranch = {
  id: string;
  name: string;
};

export type FinanceSummaryMetrics = {
  grossCollected: number;
  refundAmount: number;
  correctionAmount: number;
  netCollected: number;
  transactionCount: number;
  paidOrderCount: number;
  refundTransactionCount: number;
  pendingRefundAmount: number;
  pendingRefundCount: number;
  outstandingOrderAmount: number;
  outstandingOrderCount: number;
};

export type FinancePaymentMethod = "cash" | "card" | "app" | "unknown";

export type FinancePaymentMethodMetrics = {
  method: FinancePaymentMethod;
  grossCollected: number;
  refundAmount: number;
  correctionAmount: number;
  netCollected: number;
  transactionCount: number;
};

export type FinanceBranchPerformance = {
  branchId: string;
  branchName: string;
  grossCollected: number;
  refundAmount: number;
  correctionAmount: number;
  netCollected: number;
  transactionCount: number;
};

export type FinanceDailyTrendPoint = {
  date: string;
  grossCollected: number;
  refundAmount: number;
  correctionAmount: number;
  netCollected: number;
  transactionCount: number;
};

export type FinanceTransactionKind = "payment" | "refund" | "correction";
export type FinanceTransactionDirection = "credit" | "debit";
export type FinanceTransactionStatus = "paid" | "refunded" | "completed";
export type FinanceTransactionSource =
  | "payment_transaction"
  | "refund_request"
  | "pos_payment_adjustment";

export type FinanceTransaction = {
  id: string;
  source: FinanceTransactionSource;
  kind: FinanceTransactionKind;
  direction: FinanceTransactionDirection;
  status: FinanceTransactionStatus;
  amount: number;
  currency: string;
  paymentMethod: FinancePaymentMethod;
  branchId: string;
  branchName: string;
  orderId: string;
  occurredAt: string;
};

export type TenantFinanceSummary = {
  currency: string;
  timezone: string;
  availableCurrencies: string[];
  availableBranches: FinanceAvailableBranch[];
  summary: FinanceSummaryMetrics;
  paymentMethods: FinancePaymentMethodMetrics[];
  dailyTrend: FinanceDailyTrendPoint[];
  branchPerformance: FinanceBranchPerformance[];
  recentTransactions: FinanceTransaction[];
  filters: {
    from: string;
    to: string;
    branchId: string | null;
  };
  generatedAt: string;
};
