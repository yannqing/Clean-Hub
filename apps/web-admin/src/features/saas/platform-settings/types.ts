import type { PlatformSettings, PlatformSettingsLanguage } from "@cleanhub/api-client";

export type {
  PlatformSettings,
  PlatformSettingsLanguage,
  UpdatePlatformSettingsRequest,
} from "@cleanhub/api-client";

export type PlatformSettingsFormValues = {
  defaultLanguage: PlatformSettingsLanguage;
  defaultCurrency: string;
  timezone: string;
  maintenanceMode: boolean;
};

export type PlatformSettingsActionResult =
  | { ok: true; data: PlatformSettings }
  | { ok: false; error: string };
