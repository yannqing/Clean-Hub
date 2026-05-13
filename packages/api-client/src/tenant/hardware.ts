import type { ApiClient, QueryParams } from "../types";
import type { DeviceSummary } from "./hardware.types";

export function createTenantHardwareApi(client: ApiClient) {
  return {
    listDevices: (query?: QueryParams) =>
      client.get<DeviceSummary[]>("/tenant/hardware-configs", { query }),
  };
}
