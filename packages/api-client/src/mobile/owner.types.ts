export type MobileOwnerSummaryFeatureFlags = {
  laundryEnabled: boolean;
  carWashEnabled: boolean;
  retailProductsEnabled: boolean;
  deliveryEnabled: boolean;
  notificationsEnabled: boolean;
};

export type MobileOwnerTodaySummary = {
  tenantId: string;
  tenantName: string;
  tenantStatus: "active" | "suspended" | "disabled";
  businessDate: string;
  featureFlags: MobileOwnerSummaryFeatureFlags;
  todayOrderCount: number;
  todayRevenueAmount: number;
  pendingPickupCount: number;
  inProgressOrderCount: number;
  appointmentSummary: {
    pending: number;
    accepted: number;
    cancelled: number;
    done: number;
  };
  deliverySummary: {
    pendingDispatch: number;
    inProgress: number;
    signed: number;
    exception: number;
  };
};
