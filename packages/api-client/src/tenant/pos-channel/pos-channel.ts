import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  TenantPosChannelDeviceList,
  TenantPosChannelDeviceListQuery,
  TenantPosChannelDeviceMutationResult,
  TenantPosChannelOverview,
  TenantPosChannelOverviewQuery,
  TenantPosChannelRegisterSessionList,
  TenantPosChannelRegisterSessionQuery,
  TenantPosChannelSettings,
  RemoveTenantPosChannelDeviceRequest,
  UpdateTenantPosChannelDeviceRequest,
  UpdateTenantPosChannelSettingsRequest,
} from "./pos-channel.types";

type TenantPosChannelRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export function createTenantPosChannelApi(client: ApiClient) {
  return {
    getOverview: (
      query?: TenantPosChannelOverviewQuery,
      options: TenantPosChannelRequestOptions = {},
    ) =>
      client.get<TenantPosChannelOverview>("/tenant/pos-channel/overview", {
        ...options,
        query,
      }),
    listDevices: (
      query?: TenantPosChannelDeviceListQuery,
      options: TenantPosChannelRequestOptions = {},
    ) =>
      client.get<TenantPosChannelDeviceList>("/tenant/pos-channel/devices", {
        ...options,
        query,
      }),
    updateDevice: (
      terminalId: string,
      input: UpdateTenantPosChannelDeviceRequest,
      options: TenantPosChannelRequestOptions = {},
    ) =>
      client.patch<TenantPosChannelDeviceMutationResult>(
        `/tenant/pos-channel/devices/${encodeURIComponent(terminalId)}`,
        input,
        options,
      ),
    removeDevice: (
      terminalId: string,
      input: RemoveTenantPosChannelDeviceRequest,
      options: TenantPosChannelRequestOptions = {},
    ) =>
      client.delete<void>(
        `/tenant/pos-channel/devices/${encodeURIComponent(terminalId)}`,
        { ...options, body: input },
      ),
    listRegisterSessions: (
      query?: TenantPosChannelRegisterSessionQuery,
      options: TenantPosChannelRequestOptions = {},
    ) =>
      client.get<TenantPosChannelRegisterSessionList>(
        "/tenant/pos-channel/register-sessions",
        {
          ...options,
          query,
        },
      ),
    getSettings: (options: TenantPosChannelRequestOptions = {}) =>
      client.get<TenantPosChannelSettings>(
        "/tenant/pos-channel/settings",
        options,
      ),
    updateSettings: (
      input: UpdateTenantPosChannelSettingsRequest,
      options: TenantPosChannelRequestOptions = {},
    ) =>
      client.patch<TenantPosChannelSettings>(
        "/tenant/pos-channel/settings",
        input,
        options,
      ),
  };
}
