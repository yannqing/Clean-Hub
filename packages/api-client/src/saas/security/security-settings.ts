import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  SecuritySettings,
  UpdateSecuritySettingsRequest,
} from "./security-settings.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body">;

export function createSaasSecuritySettingsApi(client: ApiClient) {
  return {
    get: (options: RequestOptions = {}) =>
      client.get<SecuritySettings>("/saas/security/settings", options),
    update: (
      input: UpdateSecuritySettingsRequest,
      options: RequestOptions = {},
    ) =>
      client.patch<SecuritySettings>(
        "/saas/security/settings",
        input,
        options,
      ),
  };
}
