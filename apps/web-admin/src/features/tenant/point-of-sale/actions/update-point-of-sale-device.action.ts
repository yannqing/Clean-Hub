import { webAdminApi } from "@/lib/api-client";

import type { UpdatePointOfSaleDeviceInput } from "../types";

export type UpdatePointOfSaleDeviceActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updatePointOfSaleDeviceAction(
  terminalId: string,
  input: UpdatePointOfSaleDeviceInput,
): Promise<UpdatePointOfSaleDeviceActionResult> {
  try {
    await webAdminApi.tenant.posChannel.updateDevice(terminalId, input);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to update terminal.",
    };
  }
}
