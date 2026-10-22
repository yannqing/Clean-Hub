import { webAdminApi } from "@/lib/api-client";

export type DeleteDeviceActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function deleteDeviceAction(
  hardwareId: string,
  version: number,
): Promise<DeleteDeviceActionResult> {
  try {
    await webAdminApi.tenant.hardware.removeDevice(hardwareId, { version });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to delete device.",
    };
  }
}
