import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  ClockRequest,
  CreateHandoverRequest,
  HandoverRecord,
  PosStaffDetail,
  PosStaffListQuery,
  PosStaffListResponse,
  PosZReport,
  PosZReportListQuery,
  PosZReportListResponse,
  ShiftRecord,
} from "./staff.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createPosStaffApi(client: ApiClient) {
  return {
    list: (query?: PosStaffListQuery, options?: RequestOptions) =>
      client.get<PosStaffListResponse>("/pos/staff", { query, ...options }),
    get: (staffId: string, options?: RequestOptions) =>
      client.get<PosStaffDetail>(`/pos/staff/${staffId}`, options),
    currentShift: (options?: RequestOptions) =>
      client.get<ShiftRecord | null>("/pos/staff/current-shift", options),
    clock: (input: ClockRequest, options?: RequestOptions) =>
      client.post<ShiftRecord>("/pos/staff/clock", input, options),
    createHandover: (
      input: CreateHandoverRequest,
      options?: RequestOptions,
    ) => client.post<HandoverRecord>("/pos/staff/handovers", input, options),
    listZReports: (
      query?: PosZReportListQuery,
      options?: RequestOptions,
    ) =>
      client.get<PosZReportListResponse>("/pos/staff/z-reports", {
        query,
        ...options,
      }),
    getZReport: (zReportId: string, options?: RequestOptions) =>
      client.get<PosZReport>(`/pos/staff/z-reports/${zReportId}`, options),
  };
}
