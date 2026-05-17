export type TenantStatus = "active" | "suspended" | "disabled";
export type TenantLanguage = "en" | "fr" | "zh-CN";

export type TenantSummary = {
  id: string;
  name: string;
  pressingCode: string;
  status: TenantStatus;
  country: string | null;
  city: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenantStatusCounts = Record<TenantStatus, number>;

export type TenantListResponse = {
  data: TenantSummary[];
  meta: {
    total: number;
    statusCounts: TenantStatusCounts;
    limit: number;
    offset: number;
  };
};

export type TenantDetail = TenantSummary & {
  defaultLanguage: TenantLanguage;
  defaultCurrency: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  userCount: number;
};

export type CreateTenantRequest = {
  name: string;
  pressingCode: string;
  country: string;
  city?: string;
  defaultLanguage?: TenantLanguage;
  defaultCurrency?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  status?: TenantStatus;
};

export type UpdateTenantRequest = {
  name?: string;
  pressingCode?: string;
  country?: string;
  city?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};

export type UpdateTenantStatusRequest = {
  status: TenantStatus;
  reason: string;
};

export type TenantSettings = {
  id: string | null;
  tenantId: string;
  defaultLanguage: TenantLanguage;
  defaultCurrency: string;
  updatedAt: string | null;
  updatedBy: string | null;
  version: number;
};

export type UpdateTenantSettingsRequest = {
  defaultLanguage?: TenantLanguage;
  defaultCurrency?: string;
};

export type TenantFeatureFlags = {
  id: string | null;
  tenantId: string;
  laundryEnabled: boolean;
  carWashEnabled: boolean;
  retailProductsEnabled: boolean;
  deliveryEnabled: boolean;
  notificationsEnabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
  version: number;
};

export type UpdateTenantFeatureFlagsRequest = {
  laundryEnabled?: boolean;
  carWashEnabled?: boolean;
  retailProductsEnabled?: boolean;
  deliveryEnabled?: boolean;
  notificationsEnabled?: boolean;
};
