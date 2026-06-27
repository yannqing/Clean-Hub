import type { MobileCustomerOrderDetail, MobileCustomerTicketDetail } from "@cleanhub/api-client";

import { apiClient } from "@/lib/api-client";

export async function getCustomerProfile() {
  return apiClient.mobile.customer.getProfile();
}

export async function getCustomerOrdersAndTickets() {
  return apiClient.mobile.customer.listOrdersAndTickets();
}

export async function getCustomerAppointments() {
  return apiClient.mobile.customer.listAppointments();
}

export async function getCustomerActivityDetail(input: {
  kind: "order" | "ticket";
  id: string;
}): Promise<MobileCustomerOrderDetail | MobileCustomerTicketDetail> {
  if (input.kind === "order") {
    return apiClient.mobile.customer.getOrder(input.id);
  }

  return apiClient.mobile.customer.getTicket(input.id);
}
