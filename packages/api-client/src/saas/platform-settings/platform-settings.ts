import type { ApiClient } from "../../types";
import type { PlatformSettings, PlatformTaxTemplate, UpdatePlatformSettingsRequest, UpsertPlatformTaxTemplateRequest } from "./platform-settings.types";

export function createSaasPlatformSettingsApi(client: ApiClient) {
  return {
    get: () => client.get<PlatformSettings>("/saas/platform-settings"),
    update: (input: UpdatePlatformSettingsRequest) =>
      client.patch<PlatformSettings>("/saas/platform-settings", input),
    listTaxTemplates: () =>
      client.get<{ data: PlatformTaxTemplate[] }>("/saas/platform-settings/tax-templates"),
    upsertTaxTemplate: (input: UpsertPlatformTaxTemplateRequest) =>
      client.put<PlatformTaxTemplate>("/saas/platform-settings/tax-templates", input),
    importTaxTemplates: (input: UpsertPlatformTaxTemplateRequest[]) =>
      client.put<{ data: PlatformTaxTemplate[] }>("/saas/platform-settings/tax-templates/bulk", input),
  };
}
