export type {
  CreateTenantRequest,
  TenantDetail,
  TenantLanguage,
  TenantListResponse,
  TenantSettings,
  TenantStatusCounts,
  TenantStatus,
  TenantSummary,
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
