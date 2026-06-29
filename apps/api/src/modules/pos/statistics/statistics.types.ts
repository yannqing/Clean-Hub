/**
 * POS statistics module — DTOs.
 *
 * Aggregated statistics endpoints for orders, tickets, and customers.
 */

export type PosStatisticsPeriod = "today" | "week" | "month" | "all";

export type PosStatisticsQuery = {
  period?: PosStatisticsPeriod;
  branchId?: string;
};

export type PosOrderStatistics = {
  orderCount: number;
  totalAmount: string;
  paidAmount: string;
  unpaidCount: number;
  deliveredCount: number;
  cancelledCount: number;
};

export type PosTicketStatistics = {
  total: number;
  byStatus: Record<string, number>;
  overdueCount: number;
  todayCreatedCount: number;
  todayPickedUpCount: number;
};

export type PosCustomerStatistics = {
  totalCount: number;
  todayNewCount: number;
};

export type PosStatisticsOverview = {
  orders: PosOrderStatistics;
  tickets: PosTicketStatistics;
  customers: PosCustomerStatistics;
};

export type PosTicketStatisticsDetail = {
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  overdueCount: number;
  todayCreatedCount: number;
  todayPickedUpCount: number;
  todayCompletedCount: number;
};

export type PosOrderStatisticsDetail = {
  byStatus: Record<string, number>;
  byPaymentStatus: Record<string, number>;
  paymentMethods: Array<{
    method: string;
    amount: string;
    count: number;
  }>;
  totalAmount: string;
  paidAmount: string;
};

export type PosStatisticsRepositoryInput = {
  tenantId: string;
  allowedBranchIds?: string[];
  branchId?: string;
  period?: PosStatisticsPeriod;
};
