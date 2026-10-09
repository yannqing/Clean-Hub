import "server-only";

import type {
  PosStaffSummary,
  PosCurrentShiftReconciliation,
  PosRegisterState,
  PosZReport,
  ShiftRecord,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export type ShiftOperations = {
  staff: PosStaffSummary[];
  currentShift: ShiftRecord | null;
  register: PosRegisterState;
  recentReports: PosZReport[];
  reconciliation: PosCurrentShiftReconciliation | null;
};

export async function getShiftOperationsQuery(): Promise<ShiftOperations> {
  const options = await getPosServerApiRequestOptions();
  const [staff, reports, currentShift, register, reconciliation] =
    await Promise.all([
    posApi.pos.staff.list({ limit: 100 }, options),
    posApi.pos.staff.listZReports({ limit: 5 }, options),
    posApi.pos.staff.currentShift(options),
    posApi.pos.staff.currentRegister(options),
    posApi.pos.staff.currentRegisterReconciliation(options),
  ]);
  return {
    staff: staff.data,
    currentShift,
    register,
    recentReports: reports.data,
    reconciliation,
  };
}
