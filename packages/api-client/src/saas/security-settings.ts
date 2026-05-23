import type { ApiClient } from "../types";
import type {
  SecuritySettings,
  UpdateSecuritySettingsRequest,
} from "./security-settings.types";

export function createSaasSecuritySettingsApi(client: ApiClient) {
  return {
    get: () => client.get<SecuritySettings>("/saas/security/settings"),
    update: (input: UpdateSecuritySettingsRequest) =>
      client.patch<SecuritySettings>("/saas/security/settings", input),
  };
}
