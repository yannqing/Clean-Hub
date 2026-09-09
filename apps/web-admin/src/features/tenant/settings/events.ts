export const TENANT_SETTINGS_UPDATED_EVENT =
  "cleanhub:tenant-settings-updated";

export type TenantSettingsUpdatedEventDetail = {
  defaultLanguage: "en" | "fr" | "zh-CN";
  tenantName: string;
  timezone: string;
};
