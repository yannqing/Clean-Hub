import type { MobileAuthContext } from "../auth/auth.types.js";
import type { DeliveryTaskDetail } from "../delivery/delivery.types.js";

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
  currency: string;
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

export type OwnerBranchOption = {
  id: string;
  name: string;
  address: string | null;
  status: "active" | "inactive";
};

export type OwnerDriverOption = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: "active";
  branchIds: string[];
};

export type OwnerAppointmentStatus = "pending" | "accepted" | "cancelled" | "done";
export type OwnerAppointmentType = "pickup" | "dropoff";

export type OwnerAppointment = {
  id: string;
  tenantId: string;
  branchId: string;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  type: OwnerAppointmentType;
  status: OwnerAppointmentStatus;
  expectedAt: string;
  address: string;
  notes: string | null;
  deliveryTaskId: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  acceptedAt: string | null;
  acceptedBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancellationReason: string | null;
  doneAt: string | null;
  doneBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OwnerAppointmentAcceptResult = {
  appointment: OwnerAppointment;
  task: DeliveryTaskDetail;
  idempotent: boolean;
};

export type OwnerErrorCode =
  | "OWNER_FORBIDDEN"
  | "OWNER_SUMMARY_NOT_FOUND"
  | "OWNER_APPOINTMENT_NOT_FOUND"
  | "OWNER_APPOINTMENT_CONFLICT"
  | "OWNER_VALIDATION_ERROR";

export class OwnerError extends Error {
  constructor(
    readonly code: OwnerErrorCode,
    message: string,
    readonly status: 403 | 404 | 409 | 422,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OwnerError";
  }
}
