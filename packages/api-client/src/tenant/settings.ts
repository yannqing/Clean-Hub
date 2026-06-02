import type { ApiClient, ApiRequestOptions } from "../types";
import type { TenantSettings, UpdateTenantSettingsRequest } from "./settings.types";

type ApiOptionsWithoutBody = Omit<ApiRequestOptions, "method" | "body">;

export function createTenantSettingsApi(client: ApiClient) {
  return {
    get: (options: ApiOptionsWithoutBody = {}) =>
      client.get<TenantSettings>("/tenant/settings", options),
    update: (
      input: UpdateTenantSettingsRequest,
      options: ApiOptionsWithoutBody = {},
    ) => client.patch<TenantSettings>("/tenant/settings", input, options),
  };
}
