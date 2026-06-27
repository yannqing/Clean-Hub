import type {
  ApiRequestOptions,
  MobileDeliveryDispatchBoardResponse,
  MobileDeliveryTaskListItem,
  MobileOwnerAppointment,
  MobileOwnerAppointmentListResponse,
} from "@cleanhub/api-client";

import { apiClient } from "@/lib/api-client";

import type {
  OwnerAppointmentListItem,
  OwnerAppointmentListResponse,
  OwnerDispatchBoard,
  OwnerDispatchBoardFilters,
  OwnerDispatchTask,
  OwnerListAppointmentsFilters,
} from "../types";

type QueryOptions = Pick<ApiRequestOptions, "signal" | "timeoutMs">;

function toDispatchTask(task: MobileDeliveryTaskListItem): OwnerDispatchTask {
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
    notes: null,
    updatedAt: task.updatedAt,
  };
}

function toDispatchBoard(
  response: MobileDeliveryDispatchBoardResponse,
): OwnerDispatchBoard {
  const pending = response.pending.map(toDispatchTask);
  const assigned = response.assigned.map(toDispatchTask);
  const data = [...pending, ...assigned];

  return {
    data,
    summary: {
      assigned: assigned.length,
      cancelled: data.filter((task) => task.status === "cancelled").length,
      exception: data.filter((task) => task.status === "exception").length,
      inProgress: data.filter((task) =>
        ["arrived", "delivering", "en_route", "picked_up"].includes(task.status),
      ).length,
      pendingDispatch: pending.length,
      signed: data.filter((task) => task.status === "signed").length,
    },
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

function toAppointmentList(
  response: MobileOwnerAppointmentListResponse,
): OwnerAppointmentListResponse {
  return {
    data: response.data.map(toAppointmentItem),
  };
}

function toApiAppointmentStatus(status: OwnerListAppointmentsFilters["status"]) {
  return status === "rejected" ? "cancelled" : status;
}

export async function getOwnerDispatchBoard(
  filters: OwnerDispatchBoardFilters,
  options?: QueryOptions,
): Promise<OwnerDispatchBoard> {
  const response = await apiClient.mobile.delivery.getDispatchBoard(
    filters,
    options,
  );

  return toDispatchBoard(response);
}

export async function listOwnerAppointments(
  filters: OwnerListAppointmentsFilters = {},
  options?: QueryOptions,
): Promise<OwnerAppointmentListResponse> {
  const response = await apiClient.mobile.owner.listAppointments(
    {
      branchId: filters.branchId,
      status: toApiAppointmentStatus(filters.status),
    },
    options,
  );

  return toAppointmentList(response);
}
