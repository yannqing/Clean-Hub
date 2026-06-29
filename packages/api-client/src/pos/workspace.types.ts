/**
 * POS workspace API — DTOs.
 *
 * Aggregated workspace endpoints for dashboard, recent activities, and pending tasks.
 */

export type PosWorkspaceBranch = {
  id: string;
  name: string;
  status: string;
  phone: string | null;
  address: string | null;
};

export type PosWorkspaceOrderStatistics = {
  orderCount: number;
  totalAmount: string;
  paidAmount: string;
  unpaidCount: number;
};

export type PosWorkspaceTicketStatistics = {
  total: number;
  overdueCount: number;
  todayCreatedCount: number;
  todayPickedUpCount: number;
};

export type PosWorkspaceCustomerStatistics = {
  totalCount: number;
  todayNewCount: number;
};

export type PosWorkspaceStatistics = {
  orders: PosWorkspaceOrderStatistics;
  tickets: PosWorkspaceTicketStatistics;
  customers: PosWorkspaceCustomerStatistics;
};

export type PosQuickAction = {
  id: string;
  label: string;
  icon: string;
  route: string;
  color: string;
};

export type PosWorkspaceOverview = {
  branch: PosWorkspaceBranch | null;
  statistics: PosWorkspaceStatistics;
  quickActions: PosQuickAction[];
};

export type PosRecentActivityType = "order" | "ticket" | "customer" | "payment";

export type PosRecentActivity = {
  id: string;
  type: PosRecentActivityType;
  title: string;
  description: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

export type PosRecentActivitiesResponse = {
  activities: PosRecentActivity[];
};

export type PosPendingTaskType = "overdue_ticket" | "unpaid_order" | "pending_pickup";

export type PosPendingTask = {
  id: string;
  type: PosPendingTaskType;
  title: string;
  description: string;
  count: number;
  priority: "high" | "medium" | "low";
  actionRoute: string;
};

export type PosPendingTasksResponse = {
  tasks: PosPendingTask[];
};
