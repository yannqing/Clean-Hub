import type { ApiClient } from "../types";
import type { TenantSettings, UpdateTenantSettingsRequest } from "./settings.types";

export function createTenantSettingsApi(client: ApiClient) {
  return {
    get: () => client.get<TenantSettings>("/tenant/settings"),
    update: (input: UpdateTenantSettingsRequest) =>
      client.patch<TenantSettings>("/tenant/settings", input),
  };
}
