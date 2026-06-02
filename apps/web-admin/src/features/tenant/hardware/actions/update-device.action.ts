"use server";

import { webAdminApi } from "@/lib/api-client";

import type { HardwareConfigSummary, UpdateHardwareConfigRequest } from "../types";

export type UpdateDeviceActionResult =
  | { ok: true; data: HardwareConfigSummary }
  | { ok: false; error: string };

export async function updateDeviceAction(
  hardwareId: string,
  input: UpdateHardwareConfigRequest,
): Promise<UpdateDeviceActionResult> {
  try {
    const device = await webAdminApi.tenant.hardware.updateDevice(hardwareId, input);
    return { ok: true, data: device };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to update device.",
    };
  }
}
