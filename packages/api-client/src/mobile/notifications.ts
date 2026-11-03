import type { ApiClient, ApiRequestOptions } from "../types";
import type {
  MobileDeviceTokenView,
  MobileRegisterDeviceTokenRequest,
  MobileUnregisterDeviceTokenRequest,
  MobileUnregisterDeviceTokenResponse,
} from "./notifications.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createMobileNotificationsApi(client: ApiClient) {
  return {
    registerDeviceToken: (
      input: MobileRegisterDeviceTokenRequest,
      options?: RequestOptions,
    ) =>
      client.post<MobileDeviceTokenView>(
        "/mobile/notifications/device-tokens",
        input,
        options,
      ),
    unregisterDeviceToken: (
      input: MobileUnregisterDeviceTokenRequest,
      options?: RequestOptions,
    ) =>
      client.delete<MobileUnregisterDeviceTokenResponse>(
        "/mobile/notifications/device-tokens",
        {
          ...options,
          body: input,
        },
      ),
  };
}
