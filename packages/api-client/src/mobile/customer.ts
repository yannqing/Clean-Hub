import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  MobileChangeCustomerPasswordRequest,
  MobileChangeCustomerPasswordResponse,
  MobileCreateCustomerAppointmentRequest,
  MobileCustomerActivityResponse,
  MobileCustomerAddress,
  MobileCustomerAddressInput,
  MobileCustomerAppointment,
  MobileCustomerContact,
  MobileCustomerContactInput,
  MobileCustomerOrderDetail,
  MobileCustomerProfile,
  MobileCustomerTicketDetail,
  MobileCustomerListResponse,
  MobileUpdateCustomerProfileRequest,
} from "./customer.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createMobileCustomerApi(client: ApiClient) {
  return {
    getProfile: (options?: RequestOptions) =>
      client.get<MobileCustomerProfile>("/mobile/customer/profile", options),
    updateProfile: (
      input: MobileUpdateCustomerProfileRequest,
      options?: RequestOptions,
    ) =>
      client.patch<MobileCustomerProfile>(
        "/mobile/customer/profile",
        input,
        options,
      ),
    createContact: (
      input: MobileCustomerContactInput,
      options?: RequestOptions,
    ) =>
      client.post<MobileCustomerContact>(
        "/mobile/customer/contacts",
        input,
        options,
      ),
    updateContact: (
      customerId: string,
      input: MobileCustomerContactInput,
      options?: RequestOptions,
    ) =>
      client.patch<MobileCustomerContact>(
        `/mobile/customer/contacts/${encodeURIComponent(customerId)}`,
        input,
        options,
      ),
    deleteContact: (customerId: string, options?: RequestOptions) =>
      client.delete<MobileCustomerContact>(
        `/mobile/customer/contacts/${encodeURIComponent(customerId)}`,
        options,
      ),
    listAddresses: (options?: RequestOptions) =>
      client.get<MobileCustomerListResponse<MobileCustomerAddress>>(
        "/mobile/customer/addresses",
        options,
      ),
    createAddress: (
      input: MobileCustomerAddressInput,
      options?: RequestOptions,
    ) =>
      client.post<MobileCustomerAddress>(
        "/mobile/customer/addresses",
        input,
        options,
      ),
    updateAddress: (
      addressId: string,
      input: MobileCustomerAddressInput,
      options?: RequestOptions,
    ) =>
      client.patch<MobileCustomerAddress>(
        `/mobile/customer/addresses/${encodeURIComponent(addressId)}`,
        input,
        options,
      ),
    deleteAddress: (addressId: string, options?: RequestOptions) =>
      client.delete<MobileCustomerAddress>(
        `/mobile/customer/addresses/${encodeURIComponent(addressId)}`,
        options,
      ),
    setDefaultAddress: (addressId: string, options?: RequestOptions) =>
      client.post<MobileCustomerAddress>(
        `/mobile/customer/addresses/${encodeURIComponent(addressId)}/default`,
        undefined,
        options,
      ),
    changePassword: (
      input: MobileChangeCustomerPasswordRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileChangeCustomerPasswordResponse>(
        "/mobile/customer/password",
        input,
        options,
      ),
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
