import { webAdminApi } from "@/lib/api-client";

import type { RemovePointOfSaleDeviceInput } from "../types";

export type RemovePointOfSaleDeviceActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function removePointOfSaleDeviceAction(
  terminalId: string,
  input: RemovePointOfSaleDeviceInput,
): Promise<RemovePointOfSaleDeviceActionResult> {
  try {
    await webAdminApi.tenant.posChannel.removeDevice(terminalId, input);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Failed to remove terminal.",
    };
  }
}
