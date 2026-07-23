import "server-only";

import type {
  PosStaffSummary,
  PosZReport,
  ShiftRecord,
} from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export type ShiftOperations = {
  staff: PosStaffSummary[];
  currentShift: ShiftRecord | null;
  recentReports: PosZReport[];
};

export async function getShiftOperationsQuery(): Promise<ShiftOperations> {
  const options = await getPosServerApiRequestOptions();
  const [staff, currentShift, reports] = await Promise.all([
    posApi.pos.staff.list({ limit: 100 }, options),
    posApi.pos.staff.currentShift(options),
    posApi.pos.staff.listZReports({ limit: 5 }, options),
  ]);
  return {
    staff: staff.data,
    currentShift,
    recentReports: reports.data,
  };
}
