import "server-only";

import type { ShiftRecord } from "@cleanhub/api-client";

import { posApi } from "@/lib/api-client";
import { getPosServerApiRequestOptions } from "@/lib/server-api";

export async function getCurrentShiftQuery(): Promise<ShiftRecord | null> {
  return posApi.pos.staff.currentShift(await getPosServerApiRequestOptions());
}
