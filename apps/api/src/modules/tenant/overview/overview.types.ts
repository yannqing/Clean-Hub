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

export type TenantOverviewBase = {
  tenantId: string;
  tenantName: string;
  tenantStatus: "active" | "suspended" | "disabled";
  featureFlags: TenantOverviewFeatureFlags;
  currency: string;
};

export type TenantOverview = TenantOverviewBase & {
  todayOrderCount: number;
  todayRevenueAmount: number;
  pendingPickupCount: number;
  inProgressOrderCount: number;
  pendingTasksCount: number;
};
