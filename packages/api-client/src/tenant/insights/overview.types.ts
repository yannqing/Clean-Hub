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
  /** ISO-4217 currency code used to format the tenant's revenue metrics. */
  currency: string;
  todayOrderCount: number;
  todayRevenueAmount: number;
  pendingPickupCount: number;
  inProgressOrderCount: number;
  pendingTasksCount: number;
};
