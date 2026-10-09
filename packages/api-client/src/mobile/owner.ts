import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  MobileAcceptOwnerAppointmentRequest,
  MobileAcceptOwnerAppointmentResponse,
  MobileOwnerBranchListResponse,
  MobileOwnerDriverListQuery,
  MobileOwnerDriverListResponse,
  MobileOwnerAppointment,
  MobileOwnerAppointmentListQuery,
  MobileOwnerAppointmentListResponse,
  MobileOwnerTodaySummary,
  MobileRejectOwnerAppointmentRequest,
} from "./owner.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createMobileOwnerApi(client: ApiClient) {
  return {
    getTodaySummary: (options?: RequestOptions) =>
      client.get<MobileOwnerTodaySummary>(
        "/mobile/owner/summary/today",
        options,
      ),
    listBranches: (options?: RequestOptions) =>
      client.get<MobileOwnerBranchListResponse>(
        "/mobile/owner/branches",
        options,
      ),
    listDrivers: (
      query?: MobileOwnerDriverListQuery,
      options?: RequestOptions,
    ) =>
      client.get<MobileOwnerDriverListResponse>(
        "/mobile/owner/drivers",
        { ...options, query },
      ),
    listAppointments: (
      query?: MobileOwnerAppointmentListQuery,
      options?: RequestOptions,
    ) =>
      client.get<MobileOwnerAppointmentListResponse>(
        "/mobile/owner/appointments",
        { ...options, query },
      ),
    acceptAppointment: (
      appointmentId: string,
      input: MobileAcceptOwnerAppointmentRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileAcceptOwnerAppointmentResponse>(
        `/mobile/owner/appointments/${encodeURIComponent(appointmentId)}/accept`,
        input,
        options,
      ),
    rejectAppointment: (
      appointmentId: string,
      input: MobileRejectOwnerAppointmentRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileOwnerAppointment>(
        `/mobile/owner/appointments/${encodeURIComponent(appointmentId)}/reject`,
        input,
        options,
      ),
  };
}
