import { webAdminApi } from "@/lib/api-client";

import type { CreateHardwareConfigRequest, HardwareConfigSummary } from "../types";

export type BindDeviceActionResult =
  | { ok: true; data: HardwareConfigSummary }
  | { ok: false; error: string };

export async function bindDeviceAction(
  input: CreateHardwareConfigRequest,
): Promise<BindDeviceActionResult> {
  try {
    const device = await webAdminApi.tenant.hardware.createDevice(input);
    return { ok: true, data: device };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to add device.",
    };
  }
}
