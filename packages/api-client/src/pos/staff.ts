import type { ApiClient } from "../types";
import type {
  ClockRequest,
  CreateHandoverRequest,
  HandoverRecord,
  PosStaffDetail,
  PosStaffListQuery,
  PosStaffListResponse,
  ShiftRecord,
} from "./staff.types";

export function createPosStaffApi(client: ApiClient) {
  return {
    list: (query?: PosStaffListQuery) =>
      client.get<PosStaffListResponse>("/pos/staff", { query }),
    get: (staffId: string) =>
      client.get<PosStaffDetail>(`/pos/staff/${staffId}`),
    clock: (input: ClockRequest) =>
      client.post<ShiftRecord>("/pos/staff/clock", input),
    createHandover: (input: CreateHandoverRequest) =>
      client.post<HandoverRecord>("/pos/staff/handovers", input),
  };
}
