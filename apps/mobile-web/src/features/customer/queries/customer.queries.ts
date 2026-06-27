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

export async function getCustomerPaymentStatus(paymentId: string) {
  return apiClient.mobile.payment.getPaymentStatus(paymentId);
}

export async function simulateCustomerMockPayment(
  paymentId: string,
  status: "paid" | "failed",
) {
  return apiClient.mobile.payment.simulateMockPayment(paymentId, { status });
}

export async function getCustomerRefundRequests() {
  return apiClient.mobile.payment.listRefundRequests();
}
