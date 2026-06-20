/**
 * POS overview (statistics) — DTOs.
 *
 * NOTE: scaffold only. The shapes below are the dashboard metrics the POS
 * terminal home screen will surface; the aggregation queries land later.
 */
import type { AuthContext } from "../../auth/auth.types.js";

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

export type PosOverviewInput = {
  authContext: AuthContext;
  query: PosOverviewQuery;
};
