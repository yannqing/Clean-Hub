import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  TenantPosChannelDeviceList,
  TenantPosChannelDeviceListQuery,
  TenantPosChannelOverview,
  TenantPosChannelOverviewQuery,
  TenantPosChannelRegisterSessionList,
  TenantPosChannelRegisterSessionQuery,
  TenantPosChannelSettings,
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
