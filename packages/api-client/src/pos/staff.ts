import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  ClockRequest,
  CreatePosShiftCashMovementRequest,
  ClosePosRegisterRequest,
  ClosePosRegisterResult,
  OpenPosRegisterRequest,
  PosRegisterState,
  PosStaffDetail,
  PosCurrentShiftReconciliation,
  PosStaffListQuery,
  PosStaffListResponse,
  PosShiftCashMovement,
  PosShiftCashMovementListResponse,
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
    currentRegister: (options?: RequestOptions) =>
      client.get<PosRegisterState>("/pos/staff/current-register", options),
    currentRegisterReconciliation: (options?: RequestOptions) =>
      client.get<PosCurrentShiftReconciliation | null>(
        "/pos/staff/current-register/reconciliation",
        options,
      ),
    listCurrentRegisterCashMovements: (options?: RequestOptions) =>
      client.get<PosShiftCashMovementListResponse>(
        "/pos/staff/current-register/cash-movements",
        options,
      ),
    createRegisterCashMovement: (
      input: CreatePosShiftCashMovementRequest,
      options?: RequestOptions,
    ) =>
      client.post<PosShiftCashMovement>(
        "/pos/staff/current-register/cash-movements",
        input,
        { ...options, idempotencyKey: input.idempotencyKey },
      ),
    openRegister: (
      input: OpenPosRegisterRequest,
      options?: RequestOptions,
    ) =>
      client.post<PosRegisterState>(
        "/pos/staff/register-sessions/open",
        input,
        options,
      ),
    closeRegister: (
      input: ClosePosRegisterRequest,
      options?: RequestOptions,
    ) =>
      client.post<ClosePosRegisterResult>(
        "/pos/staff/register-sessions/close",
        input,
        options,
      ),
    clock: (input: ClockRequest, options?: RequestOptions) =>
      client.post<ShiftRecord>("/pos/staff/clock", input, options),
    listZReports: (query?: PosZReportListQuery, options?: RequestOptions) =>
      client.get<PosZReportListResponse>("/pos/staff/z-reports", {
        query,
        ...options,
      }),
    getZReport: (zReportId: string, options?: RequestOptions) =>
      client.get<PosZReport>(`/pos/staff/z-reports/${zReportId}`, options),
  };
}
