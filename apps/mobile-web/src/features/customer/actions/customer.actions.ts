import type {
  MobileCreateCustomerAppointmentRequest,
  MobileCreateRefundRequest,
} from "@cleanhub/api-client";

import { apiClient } from "@/lib/api-client";

export async function createCustomerAppointment(input: MobileCreateCustomerAppointmentRequest) {
  return apiClient.mobile.customer.createAppointment({
    type: input.type,
    expectedAt: input.expectedAt,
    address: input.address.trim(),
    notes: input.notes?.trim() || undefined,
    branchId: input.branchId,
    customerId: input.customerId,
  });
}

export async function cancelCustomerAppointment(appointmentId: string) {
  return apiClient.mobile.customer.cancelAppointment(appointmentId);
}

export async function createCustomerPayment(input: {
  orderId: string;
  amount: string;
}) {
  return apiClient.mobile.payment.createPayment(input.orderId, {
    amount: input.amount,
    idempotencyKey: `mobile-pay-${input.orderId}-${Date.now()}`,
  });
}

export async function createCustomerRefundRequest(
  orderId: string,
  input: MobileCreateRefundRequest,
) {
  return apiClient.mobile.payment.createRefundRequest(orderId, {
    amount: input.amount,
    reason: input.reason.trim(),
  });
}
