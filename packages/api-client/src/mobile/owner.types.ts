import type { MobileDeliveryTaskDetail } from "./delivery.types";

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

export type MobileOwnerAppointmentStatus =
  | "pending"
  | "accepted"
  | "cancelled"
  | "done";

export type MobileOwnerAppointmentType = "pickup" | "dropoff";

export type MobileOwnerAppointment = {
  id: string;
  tenantId: string;
  branchId: string;
  customerId: string;
  deliveryTaskId: string | null;
  type: MobileOwnerAppointmentType;
  status: MobileOwnerAppointmentStatus;
  expectedAt: string;
  address: string;
  notes: string | null;
  acceptedBy: string | null;
  acceptedAt: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  doneAt: string | null;
  doneBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MobileOwnerAppointmentListQuery = {
  branchId?: string;
  status?: MobileOwnerAppointmentStatus;
};

export type MobileOwnerAppointmentListResponse = {
  data: MobileOwnerAppointment[];
};

export type MobileAcceptOwnerAppointmentRequest = {
  idempotencyKey: string;
  assigneeUserId?: string;
  notes?: string;
};

export type MobileAcceptOwnerAppointmentResponse = {
  appointment: MobileOwnerAppointment;
  task: MobileDeliveryTaskDetail;
  idempotent: boolean;
};

export type MobileRejectOwnerAppointmentRequest = {
  reason: string;
};
