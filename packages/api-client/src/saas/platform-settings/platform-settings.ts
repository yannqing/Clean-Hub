import type { ApiClient } from "../../types";
import type { PlatformSettings, UpdatePlatformSettingsRequest } from "./platform-settings.types";

export function createSaasPlatformSettingsApi(client: ApiClient) {
  return {
    get: () => client.get<PlatformSettings>("/saas/platform-settings"),
    update: (input: UpdatePlatformSettingsRequest) =>
      client.patch<PlatformSettings>("/saas/platform-settings", input),
  };
}
