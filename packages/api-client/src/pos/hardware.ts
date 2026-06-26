import type { ApiClient } from "../types";
import type { PosHardwareDeviceListResponse } from "./hardware.types";

/**
 * POS hardware device API (read-only).
 *
 * POS terminals can list hardware devices configured for their branch
 * but cannot create, update, or delete them.
 */
export function createPosHardwareApi(client: ApiClient) {
  return {
    list: () =>
      client.get<PosHardwareDeviceListResponse>("/pos/hardware-devices"),
  };
}
