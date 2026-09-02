import "server-only";

import type {
  PosStaffSummary,
  PosCurrentShiftReconciliation,
  PosZReport,
  ShiftRecord,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export type ShiftOperations = {
  staff: PosStaffSummary[];
  currentShift: ShiftRecord | null;
  recentReports: PosZReport[];
  reconciliation: PosCurrentShiftReconciliation | null;
};

export async function getShiftOperationsQuery(): Promise<ShiftOperations> {
  const options = await getPosServerApiRequestOptions();
  const [staff, currentShift, reports, reconciliation] = await Promise.all([
    posApi.pos.staff.list({ limit: 100 }, options),
    posApi.pos.staff.currentShift(options),
    posApi.pos.staff.listZReports({ limit: 5 }, options),
    posApi.pos.staff.currentShiftReconciliation(options),
  ]);
  return {
    staff: staff.data,
    currentShift,
    recentReports: reports.data,
    reconciliation,
  };
}
