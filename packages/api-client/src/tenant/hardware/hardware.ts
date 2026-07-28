import type { ApiClient, ApiRequestOptions, QueryParams } from "../../types";
import type {
  CreateHardwareConfigRequest,
  DeleteHardwareConfigRequest,
  HardwareConfigSummary,
  UpdateHardwareConfigRequest,
} from "./hardware.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createTenantHardwareApi(client: ApiClient) {
  return {
    listDevices: (query?: QueryParams, options?: RequestOptions) =>
      client.get<HardwareConfigSummary[]>("/tenant/hardware-configs", {
        ...options,
        query,
      }),
    createDevice: (input: CreateHardwareConfigRequest) =>
      client.post<HardwareConfigSummary>("/tenant/hardware-configs", input),
    updateDevice: (hardwareId: string, input: UpdateHardwareConfigRequest) =>
      client.patch<HardwareConfigSummary>(`/tenant/hardware-configs/${hardwareId}`, input),
    removeDevice: (hardwareId: string, input: DeleteHardwareConfigRequest) =>
      client.delete<void>(`/tenant/hardware-configs/${hardwareId}`, { body: input }),
  };
}
