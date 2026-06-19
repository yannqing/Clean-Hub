import type { AuthContext } from "../../auth/auth.types.js";

export type TenantOverviewInput = {
  authContext: AuthContext;
};

export type TenantOverviewFeatureFlags = {
  laundryEnabled: boolean;
  carWashEnabled: boolean;
  retailProductsEnabled: boolean;
  deliveryEnabled: boolean;
  notificationsEnabled: boolean;
};

export type TenantOverview = {
  tenantId: string;
  tenantName: string;
  tenantStatus: "active" | "suspended" | "disabled";
  featureFlags: TenantOverviewFeatureFlags;
  todayOrderCount: number;
  todayRevenueAmount: number;
  pendingPickupCount: number;
  inProgressOrderCount: number;
  pendingTasksCount: number;
};
