import type {
  MobileAcceptOwnerAppointmentResponse,
  MobileDeliveryMutationResult,
  MobileDeliveryTaskListItem,
  MobileOwnerAppointment,
} from "@cleanhub/api-client";

import { apiClient } from "@/lib/api-client";

import { createOwnerLocalId } from "../lib/id";
import type {
  OwnerAppointmentListItem,
  OwnerDispatchTask,
  OwnerMutationResult,
} from "../types";

function toDispatchTask(
  task: MobileDeliveryTaskListItem & { notes?: string | null },
): OwnerDispatchTask {
  return {
    id: task.id,
    tenantId: task.tenantId,
    branchId: task.branchId,
    type: task.type,
    status: task.status,
    expectedAt: task.expectedAt,
    customerName: task.customerName,
    customerPhone: task.customerPhone,
    address: task.address,
    orderId: task.orderId,
    ticketId: task.ticketId,
    assigneeUserId: task.assigneeUserId,
    assigneeName: null,
    notes: task.notes ?? null,
    updatedAt: task.updatedAt,
  };
}

function toAppointmentItem(
  appointment: MobileOwnerAppointment,
): OwnerAppointmentListItem {
  return {
    id: appointment.id,
    tenantId: appointment.tenantId,
    branchId: appointment.branchId,
    status: appointment.status,
    customerName: appointment.customerId,
    customerPhone: null,
    address: appointment.address,
    requestedAt: appointment.createdAt,
    scheduledAt: appointment.expectedAt,
    serviceType: appointment.type,
    notes: appointment.notes,
    assigneeUserId: null,
    deliveryTaskId: appointment.deliveryTaskId,
    createdAt: appointment.createdAt,
    updatedAt: appointment.updatedAt,
  };
}

function toDeliveryMutationResult(
  result: MobileDeliveryMutationResult,
): OwnerMutationResult {
  return {
    idempotent: result.idempotent,
    task: toDispatchTask(result.task),
  };
}

function toAcceptAppointmentResult(
  result: MobileAcceptOwnerAppointmentResponse,
): OwnerMutationResult {
  return {
    idempotent: result.idempotent,
    appointment: toAppointmentItem(result.appointment),
    task: toDispatchTask(result.task),
  };
}

export async function dispatchOwnerTask(input: {
  taskId: string;
  assigneeUserId: string;
  note?: string;
}): Promise<OwnerMutationResult> {
  return toDeliveryMutationResult(
    await apiClient.mobile.delivery.dispatchTask(input.taskId, {
      assigneeUserId: input.assigneeUserId,
      idempotencyKey: createOwnerLocalId(),
      note: input.note?.trim() || undefined,
    }),
  );
}

export async function reassignOwnerTask(input: {
  taskId: string;
  assigneeUserId: string;
  note?: string;
}): Promise<OwnerMutationResult> {
  return toDeliveryMutationResult(
    await apiClient.mobile.delivery.reassignTask(input.taskId, {
      assigneeUserId: input.assigneeUserId,
      idempotencyKey: createOwnerLocalId(),
      note: input.note?.trim() || undefined,
    }),
  );
}

export async function cancelOwnerTask(input: {
  taskId: string;
  reason: string;
}): Promise<OwnerMutationResult> {
  return toDeliveryMutationResult(
    await apiClient.mobile.delivery.cancelTask(input.taskId, {
      idempotencyKey: createOwnerLocalId(),
      reason: input.reason,
    }),
  );
}

export async function acceptOwnerAppointment(input: {
  appointmentId: string;
  assigneeUserId?: string;
  notes?: string;
}): Promise<OwnerMutationResult> {
  return toAcceptAppointmentResult(
    await apiClient.mobile.owner.acceptAppointment(input.appointmentId, {
      idempotencyKey: createOwnerLocalId(),
      assigneeUserId: input.assigneeUserId?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
    }),
  );
}

export async function rejectOwnerAppointment(input: {
  appointmentId: string;
  reason: string;
}): Promise<OwnerMutationResult> {
  return {
    appointment: toAppointmentItem(
      await apiClient.mobile.owner.rejectAppointment(input.appointmentId, {
        reason: input.reason,
      }),
    ),
  };
}
