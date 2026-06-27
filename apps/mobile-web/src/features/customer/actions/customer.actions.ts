import type { MobileCreateCustomerAppointmentRequest } from "@cleanhub/api-client";

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
