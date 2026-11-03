import type { MobileAuthContext } from "../auth/auth.types.js";

export type DeliveryTaskStatus =
  | "pending_dispatch"
  | "en_route"
  | "arrived"
  | "picked_up"
  | "delivering"
  | "signed"
  | "exception"
  | "cancelled";

export type DeliveryTaskType = "pickup" | "dropoff";
export type DeliveryProofType = "pickup" | "dropoff" | "signature";

export type DeliveryTaskListItem = {
  id: string;
  tenantId: string;
  branchId: string;
  appointmentId: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  type: DeliveryTaskType;
  status: DeliveryTaskStatus;
  expectedAt: string | null;
  customerName: string;
  customerPhone: string | null;
  address: string;
  orderId: string | null;
  ticketId: string | null;
  updatedAt: string;
};

export type DeliveryTaskDetail = DeliveryTaskListItem & {
  customerId: string;
  notes: string | null;
  exceptionReason: string | null;
  cancellationReason: string | null;
  dispatchedAt: string | null;
  dispatchedBy: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  timeline: DeliveryTaskEvent[];
  proofs: DeliveryProof[];
  order: DeliveryOrderSummary | null;
  ticket: DeliveryTicketSummary | null;
};

export type DeliveryOrderSummary = {
  id: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
};

export type DeliveryTicketSummary = {
  id: string;
  ticketNo: string | null;
  ticketStatus: string;
  expectedPickupAt: string | null;
};

export type DeliveryTaskEvent = {
  id: string;
  taskId: string;
  fromStatus: DeliveryTaskStatus | null;
  toStatus: DeliveryTaskStatus;
  lat: string | null;
  lng: string | null;
  deviceId: string | null;
  idempotencyKey: string;
  note: string | null;
  createdAt: string;
};

export type DeliveryProof = {
  id: string;
  taskId: string;
  type: DeliveryProofType;
  mediaRef: string;
  mediaUrl?: string;
  mediaUrlExpiresAt?: string;
  deviceId: string | null;
  idempotencyKey: string;
  capturedAt: string | null;
  createdAt: string;
};

export type DeliveryDriverContext = MobileAuthContext & {
  subjectType: "staff";
  role: "driver";
};

export type DeliveryUpdateStatusInput = {
  authContext: MobileAuthContext;
  taskId: string;
  toStatus: DeliveryTaskStatus;
  idempotencyKey: string;
  lat?: string;
  lng?: string;
  deviceId?: string;
  note?: string;
  exceptionReason?: string;
};

export type DeliveryUploadProofInput = {
  authContext: MobileAuthContext;
  taskId: string;
  type: Exclude<DeliveryProofType, "signature">;
  mediaRef: string;
  idempotencyKey: string;
  deviceId?: string;
  capturedAt?: Date;
};

export type DeliverySignTaskInput = {
  authContext: MobileAuthContext;
  taskId: string;
  signatureMediaRef: string;
  idempotencyKey: string;
  lat?: string;
  lng?: string;
  deviceId?: string;
  capturedAt?: Date;
  signedByName?: string;
};

export type DeliveryAssignTaskInput = {
  authContext: MobileAuthContext;
  tenantId: string;
  branchId: string;
  assigneeUserId?: string;
  customerId: string;
  type: DeliveryTaskType;
  customerName: string;
  address: string;
  customerPhone?: string;
  orderId?: string;
  ticketId?: string;
  expectedAt?: Date;
  notes?: string;
};

export type DeliveryDispatchTaskInput = {
  authContext: MobileAuthContext;
  taskId: string;
  assigneeUserId: string;
  idempotencyKey: string;
  note?: string;
};

export type DeliveryReassignTaskInput = DeliveryDispatchTaskInput;

export type DeliveryCancelTaskInput = {
  authContext: MobileAuthContext;
  taskId: string;
  idempotencyKey: string;
  reason: string;
};

export type DeliveryDispatchBoardQuery = {
  authContext: MobileAuthContext;
  branchId: string;
  assigneeUserId?: string;
  status?: DeliveryTaskStatus;
  from?: Date;
  to?: Date;
};

export type DeliveryDispatchBoard = {
  pending: DeliveryTaskListItem[];
  assigned: DeliveryTaskListItem[];
};

export type DeliveryMutationResult = {
  task: DeliveryTaskDetail;
  event?: DeliveryTaskEvent;
  proof?: DeliveryProof;
  idempotent: boolean;
};

export type DeliveryErrorCode =
  | "DELIVERY_FORBIDDEN"
  | "DELIVERY_TASK_NOT_FOUND"
  | "DELIVERY_TASK_CONFLICT"
  | "DELIVERY_MEDIA_NOT_FOUND"
  | "DELIVERY_VALIDATION_ERROR";

export class DeliveryError extends Error {
  constructor(
    readonly code: DeliveryErrorCode,
    message: string,
    readonly status: 403 | 404 | 409 | 422,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "DeliveryError";
  }
}
