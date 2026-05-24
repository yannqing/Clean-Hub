export type {
  CreateTenantRequest,
  TenantDetail,
  TenantFeatureFlags,
  TenantLanguage,
  TenantListResponse,
  TenantSettings,
  TenantStatusCounts,
  TenantStatus,
  TenantSummary,
  UpdateTenantFeatureFlagsRequest,
  UpdateTenantSettingsRequest,
  UpdateTenantRequest,
} from "@cleanhub/api-client";

export type TenantFormValues = {
  name: string;
  pressingCode: string;
  country: string;
  city: string;
  defaultLanguage: "en" | "fr" | "zh-CN";
  defaultCurrency: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
};

export type TenantSettingsFormValues = {
  defaultLanguage: TenantFormValues["defaultLanguage"];
  defaultCurrency: string;
};

export type TenantFeatureFlagsFormValues = {
  laundryEnabled: boolean;
  carWashEnabled: boolean;
  retailProductsEnabled: boolean;
  deliveryEnabled: boolean;
  notificationsEnabled: boolean;
};
