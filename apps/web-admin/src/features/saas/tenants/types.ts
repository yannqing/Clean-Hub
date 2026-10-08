import type { TenantLanguage } from "@cleanhub/api-client";

export type {
  CreateTenantResponse,
  CreateTenantRequest,
  TenantDetail,
  TenantFeatureFlags,
  TenantLanguage,
  TenantListResponse,
  TenantSettings,
  TenantStatusCounts,
  TenantStatus,
  TenantSummary,
  SaasTenantUserSummary,
  UpdateTenantFeatureFlagsRequest,
  UpdateTenantSettingsRequest,
  UpdateTenantRequest,
} from "@cleanhub/api-client";

export type TenantFormDefaultLanguage = TenantLanguage | "platform-default";

export type TenantFormValues = {
  name: string;
  pressingCode: string;
  country: string;
  city: string;
  defaultLanguage: TenantFormDefaultLanguage;
  defaultCurrency: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  initialOwnerDisplayName: string;
  initialOwnerEmail: string;
  initialOwnerPhone: string;
};

export type TenantSettingsFormValues = {
  defaultLanguage: TenantLanguage;
  defaultCurrency: string;
};

export type TenantFeatureFlagsFormValues = {
  laundryEnabled: boolean;
  carWashEnabled: boolean;
  retailProductsEnabled: boolean;
  deliveryEnabled: boolean;
  notificationsEnabled: boolean;
  emailEnabled: boolean;
  customerOtpEnabled: boolean;
};
