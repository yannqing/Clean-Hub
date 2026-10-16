import type {
  FinancePaymentMethod as ApiFinancePaymentMethod,
  FinanceTransactionDirection as ApiFinanceTransactionDirection,
  FinanceTransactionKind as ApiFinanceTransactionKind,
  FinanceTransactionStatus as ApiFinanceTransactionStatus,
  TenantFinanceSummary,
  TenantFinanceSummaryQuery,
} from "@cleanhub/api-client";

export type FinanceSummary = TenantFinanceSummary;
export type FinanceSummaryQuery = TenantFinanceSummaryQuery;
export type FinancePaymentMethod = ApiFinancePaymentMethod;
export type FinanceTransactionKind = ApiFinanceTransactionKind;
export type FinanceTransactionDirection = ApiFinanceTransactionDirection;
export type FinanceTransactionStatus = ApiFinanceTransactionStatus;
