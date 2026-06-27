export type MobileDeliveryTaskStatus =
  | "pending_dispatch"
  | "en_route"
  | "arrived"
  | "picked_up"
  | "delivering"
  | "signed"
  | "exception"
  | "cancelled";

export type MobileDeliveryTaskType = "pickup" | "dropoff";
export type MobileDeliveryProofType = "pickup" | "dropoff" | "signature";

export type MobileDeliveryTaskListItem = {
  id: string;
  tenantId: string;
  branchId: string;
  type: MobileDeliveryTaskType;
  status: MobileDeliveryTaskStatus;
  expectedAt: string | null;
  customerName: string;
  customerPhone: string | null;
  address: string;
  orderId: string | null;
  ticketId: string | null;
  updatedAt: string;
};

export type MobileDeliveryOrderSummary = {
  id: string;
  status: string;
  paymentStatus: string;
  totalAmount: string;
};

export type MobileDeliveryTicketSummary = {
  id: string;
  ticketNo: string | null;
  ticketStatus: string;
  expectedPickupAt: string | null;
};

export type MobileDeliveryTaskEvent = {
  id: string;
  taskId: string;
  fromStatus: MobileDeliveryTaskStatus | null;
  toStatus: MobileDeliveryTaskStatus;
  lat: string | null;
  lng: string | null;
  deviceId: string | null;
  idempotencyKey: string;
  note: string | null;
  createdAt: string;
};

export type MobileDeliveryProof = {
  id: string;
  taskId: string;
  type: MobileDeliveryProofType;
  mediaRef: string;
  mediaUrl?: string;
  mediaUrlExpiresAt?: string;
  deviceId: string | null;
  idempotencyKey: string;
  capturedAt: string | null;
  createdAt: string;
};

export type MobileDeliveryTaskDetail = MobileDeliveryTaskListItem & {
  customerId: string;
  notes: string | null;
  exceptionReason: string | null;
  timeline: MobileDeliveryTaskEvent[];
  proofs: MobileDeliveryProof[];
  order: MobileDeliveryOrderSummary | null;
  ticket: MobileDeliveryTicketSummary | null;
};

export type MobileDeliveryMutationResult = {
  task: MobileDeliveryTaskDetail;
  event?: MobileDeliveryTaskEvent;
  proof?: MobileDeliveryProof;
  idempotent: boolean;
};

export type MobileUpdateDeliveryStatusRequest = {
  toStatus: MobileDeliveryTaskStatus;
  idempotencyKey: string;
  lat?: string | number;
  lng?: string | number;
  deviceId?: string;
  note?: string;
  exceptionReason?: string;
};

export type MobileUploadDeliveryProofRequest = {
  type: Exclude<MobileDeliveryProofType, "signature">;
  idempotencyKey: string;
  mediaRef: string;
  deviceId?: string;
  capturedAt?: string;
};

export type MobileSignDeliveryTaskRequest = {
  idempotencyKey: string;
  signatureMediaRef: string;
  lat?: string | number;
  lng?: string | number;
  deviceId?: string;
  capturedAt?: string;
  signedByName?: string;
};

export type MobileAssignDeliveryTaskRequest = {
  tenantId: string;
  branchId: string;
  assigneeUserId: string;
  customerId: string;
  type: MobileDeliveryTaskType;
  customerName: string;
  customerPhone?: string;
  address: string;
  orderId?: string;
  ticketId?: string;
  expectedAt?: string;
  notes?: string;
};

export type MobileDeliveryListResponse<T> = {
  data: T[];
};
