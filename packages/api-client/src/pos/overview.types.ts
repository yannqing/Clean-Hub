export type PosOverviewPeriod = "today" | "week" | "month";

export type PosOverview = {
  branchId: string;
  period: PosOverviewPeriod;
  orderCount: number;
  openTicketCount: number;
  revenueAmount: string;
  currency: string;
};

export type PosOverviewQuery = {
  period?: PosOverviewPeriod;
};
