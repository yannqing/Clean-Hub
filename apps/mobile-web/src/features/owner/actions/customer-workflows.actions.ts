import type { MobileRefundSettlementInput } from "@cleanhub/api-client";
import { apiClient } from "@/lib/api-client";

export function getRefundSettlement(requestId: string) {
  return apiClient.mobile.payment.getRefundSettlement(requestId);
}
export function settleRefund(
  requestId: string,
  input: MobileRefundSettlementInput,
) {
  return apiClient.mobile.payment.settleRefund(requestId, input);
}
export function receiveAppointment(
  appointmentId: string,
  ticketType: "laundry" | "car_wash",
) {
  return apiClient.mobile.owner.receiveAppointment(appointmentId, {
    ticketType,
  });
}
