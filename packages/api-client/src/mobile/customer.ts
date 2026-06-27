import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  MobileCreateCustomerAppointmentRequest,
  MobileCustomerActivityResponse,
  MobileCustomerAppointment,
  MobileCustomerOrderDetail,
  MobileCustomerProfile,
  MobileCustomerTicketDetail,
  MobileCustomerListResponse,
} from "./customer.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createMobileCustomerApi(client: ApiClient) {
  return {
    getProfile: (options?: RequestOptions) =>
      client.get<MobileCustomerProfile>("/mobile/customer/profile", options),
    listOrdersAndTickets: (options?: RequestOptions) =>
      client.get<MobileCustomerActivityResponse>(
        "/mobile/customer/orders",
        options,
      ),
    getOrder: (orderId: string, options?: RequestOptions) =>
      client.get<MobileCustomerOrderDetail>(
        `/mobile/customer/orders/${encodeURIComponent(orderId)}`,
        options,
      ),
    getTicket: (ticketId: string, options?: RequestOptions) =>
      client.get<MobileCustomerTicketDetail>(
        `/mobile/customer/tickets/${encodeURIComponent(ticketId)}`,
        options,
      ),
    listAppointments: (options?: RequestOptions) =>
      client.get<MobileCustomerListResponse<MobileCustomerAppointment>>(
        "/mobile/customer/appointments",
        options,
      ),
    createAppointment: (
      input: MobileCreateCustomerAppointmentRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileCustomerAppointment>(
        "/mobile/customer/appointments",
        input,
        options,
      ),
    cancelAppointment: (appointmentId: string, options?: RequestOptions) =>
      client.post<MobileCustomerAppointment>(
        `/mobile/customer/appointments/${encodeURIComponent(appointmentId)}/cancel`,
        undefined,
        options,
      ),
  };
}
