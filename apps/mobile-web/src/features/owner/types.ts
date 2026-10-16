import type { MobileDeliveryTaskStatus, MobileDeliveryTaskType } from "@cleanhub/api-client";

export type OwnerAppointmentStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "done";

export type OwnerAppointmentListItem = {
  id: string;
  tenantId?: string;
  branchId: string | null;
  status: OwnerAppointmentStatus;
  customerName: string;
  customerPhone: string | null;
  address: string | null;
  requestedAt: string | null;
  scheduledAt: string | null;
  serviceType: string | null;
  notes: string | null;
  assigneeUserId: string | null;
  deliveryTaskId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OwnerAppointmentListResponse = {
  data: OwnerAppointmentListItem[];
};

export type OwnerDispatchTask = {
  id: string;
  tenantId?: string;
  branchId: string;
  type: MobileDeliveryTaskType;
  status: MobileDeliveryTaskStatus;
  expectedAt: string | null;
  customerName: string;
  customerPhone: string | null;
  address: string;
  orderId: string | null;
  ticketId: string | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  notes: string | null;
  updatedAt: string;
};

export type OwnerDispatchBoard = {
  data: OwnerDispatchTask[];
  summary?: {
    pendingDispatch: number;
    assigned: number;
    inProgress: number;
    exception: number;
    signed: number;
    cancelled: number;
  };
};

export type OwnerDispatchBoardFilters = {
  branchId: string;
  assigneeUserId?: string;
  status?: MobileDeliveryTaskStatus;
  from?: string;
  to?: string;
};

export type OwnerListAppointmentsFilters = {
  branchId?: string;
  status?: OwnerAppointmentStatus;
};

export type OwnerMutationResult = {
  idempotent?: boolean;
  task?: OwnerDispatchTask;
  appointment?: OwnerAppointmentListItem;
};
