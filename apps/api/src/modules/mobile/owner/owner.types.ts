import type { MobileAuthContext } from "../auth/auth.types.js";

export type OwnerMobileContext = MobileAuthContext & {
  subjectType: "staff";
  role: "owner";
};

export type OwnerSummaryFeatureFlags = {
  laundryEnabled: boolean;
  carWashEnabled: boolean;
  retailProductsEnabled: boolean;
  deliveryEnabled: boolean;
  notificationsEnabled: boolean;
};

export type OwnerTodaySummary = {
  tenantId: string;
  tenantName: string;
  tenantStatus: "active" | "suspended" | "disabled";
  businessDate: string;
  featureFlags: OwnerSummaryFeatureFlags;
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

export type OwnerErrorCode =
  | "OWNER_FORBIDDEN"
  | "OWNER_SUMMARY_NOT_FOUND";

export class OwnerError extends Error {
  constructor(
    readonly code: OwnerErrorCode,
    message: string,
    readonly status: 403 | 404,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OwnerError";
  }
}
