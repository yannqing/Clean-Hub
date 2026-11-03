export type PlatformSettingsLanguage = "en" | "fr" | "zh-CN";

export type PlatformSettings = {
  id: string | null;
  defaultLanguage: PlatformSettingsLanguage;
  defaultCurrency: string;
  timezone: string;
  maintenanceMode: boolean;
  mobileMinimumVersion?: string;
  mobileUpdateUrl?: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  version: number;
};

export type UpdatePlatformSettingsRequest = {
  defaultLanguage?: PlatformSettingsLanguage;
  defaultCurrency?: string;
  timezone?: string;
  maintenanceMode?: boolean;
  mobileMinimumVersion?: string;
  mobileUpdateUrl?: string | null;
};

export type PlatformTaxTemplate = {
  id: string;
  countryCode: string;
  name: string;
  currencyCode: string | null;
  taxLabel: string | null;
  exemptionNotes: string | null;
  taxEnabled: boolean;
  ready: boolean;
  pricesIncludeTax: boolean;
  rates: Array<{
    key?: string;
    name: string;
    rate: string;
    isDefault: boolean;
    components?: Array<{ name: string; rate: string }>;
  }>;
  version: number;
  updatedAt: string;
};

export type UpsertPlatformTaxTemplateRequest = Omit<PlatformTaxTemplate, "id" | "version" | "updatedAt" | "ready">;
