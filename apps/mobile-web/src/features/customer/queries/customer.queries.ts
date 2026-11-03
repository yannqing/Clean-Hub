import type { MobileCustomerOrderDetail, MobileCustomerTicketDetail } from "@cleanhub/api-client";

import { apiClient } from "@/lib/api-client";
import { cachedCustomerQuery } from "../lib/customer-cache";

export async function getCustomerProfile() {
  return cachedCustomerQuery("profile", () => apiClient.mobile.customer.getProfile());
}

export async function getCustomerAddresses() {
  return cachedCustomerQuery("addresses", () => apiClient.mobile.customer.listAddresses());
}

export async function getCustomerBranches() {
  return cachedCustomerQuery("branches", () => apiClient.mobile.customer.listBranches());
}

export async function getCustomerOrdersAndTickets(offset = 0) {
  return cachedCustomerQuery(`activity:${offset}`, () => apiClient.mobile.customer.listOrdersAndTickets(undefined, { offset }));
}

export async function getCustomerAppointments(offset = 0) {
  return cachedCustomerQuery(`appointments:${offset}`, () => apiClient.mobile.customer.listAppointments(undefined, { offset }));
}

export async function getCustomerActivityDetail(input: {
  kind: "order" | "ticket";
  id: string;
}): Promise<MobileCustomerOrderDetail | MobileCustomerTicketDetail> {
  if (input.kind === "order") {
    return cachedCustomerQuery(`order:${input.id}`, () => apiClient.mobile.customer.getOrder(input.id));
  }

  return cachedCustomerQuery(`ticket:${input.id}`, () => apiClient.mobile.customer.getTicket(input.id));
}

export async function getCustomerPaymentStatus(paymentId: string) {
  return apiClient.mobile.payment.getPaymentStatus(paymentId);
}

export async function getCustomerRefundRequests() {
  return cachedCustomerQuery("refunds", () => apiClient.mobile.payment.listRefundRequests());
}
