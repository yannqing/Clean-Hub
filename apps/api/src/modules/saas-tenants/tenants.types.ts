import type { AuthContext, AuthRequestMeta } from "../auth/auth.types.js";

export type SaasTenantStatus = "active" | "suspended" | "disabled";
export type SaasTenantLanguage = "en" | "fr" | "zh-CN";

export type ListSaasTenantsQuery = {
  q?: string;
  status?: SaasTenantStatus;
  limit: number;
  offset: number;
};

export type ListSaasTenantsInput = {
  authContext: AuthContext;
  query: ListSaasTenantsQuery;
};

export type SaasTenantStatusCounts = Record<SaasTenantStatus, number>;

export type SaasTenantListResult = {
  items: SaasTenantListItem[];
  total: number;
  statusCounts: SaasTenantStatusCounts;
};

export type GetSaasTenantDetailInput = {
  authContext: AuthContext;
  tenantId: string;
};

export type CreateSaasTenantRequest = {
  name: string;
  pressingCode: string;
  country: string;
  city?: string;
  defaultLanguage?: SaasTenantLanguage;
  defaultCurrency: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  status?: SaasTenantStatus;
};

export type CreateSaasTenantInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  data: CreateSaasTenantRequest;
};

export type UpdateSaasTenantRequest = {
  name?: string;
  pressingCode?: string;
  country?: string;
  city?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
};

export type UpdateSaasTenantInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  tenantId: string;
  data: UpdateSaasTenantRequest;
};

export type UpdateSaasTenantStatusRequest = {
  status: SaasTenantStatus;
  reason: string;
};

export type UpdateSaasTenantStatusInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  tenantId: string;
  data: UpdateSaasTenantStatusRequest;
};

export type SaasTenantSettings = {
  id: string | null;
  tenantId: string;
  defaultLanguage: SaasTenantLanguage;
  defaultCurrency: string;
  updatedAt: string | null;
  updatedBy: string | null;
  version: number;
};

export type UpdateSaasTenantSettingsRequest = {
  defaultLanguage?: SaasTenantLanguage;
  defaultCurrency?: string;
};

export type GetSaasTenantSettingsInput = {
  authContext: AuthContext;
  tenantId: string;
};

export type UpdateSaasTenantSettingsInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  tenantId: string;
  data: UpdateSaasTenantSettingsRequest;
};

export type SaasTenantFeatureFlags = {
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

export type UpdateSaasTenantFeatureFlagsRequest = {
  laundryEnabled?: boolean;
  carWashEnabled?: boolean;
  retailProductsEnabled?: boolean;
  deliveryEnabled?: boolean;
  notificationsEnabled?: boolean;
};

export type GetSaasTenantFeatureFlagsInput = {
  authContext: AuthContext;
  tenantId: string;
};

export type UpdateSaasTenantFeatureFlagsInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  tenantId: string;
  data: UpdateSaasTenantFeatureFlagsRequest;
};

export type SaasTenantListItem = {
  id: string;
  name: string;
  pressingCode: string;
  status: SaasTenantStatus;
  country: string | null;
  city: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaasTenantDetail = SaasTenantListItem & {
  defaultLanguage: SaasTenantLanguage;
  defaultCurrency: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  userCount: number;
};

export type SaasTenantAuditSnapshot = {
  name: string;
  pressingCode: string;
  status: SaasTenantStatus;
  country: string | null;
  city: string | null;
  defaultLanguage: string;
  defaultCurrency: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
};
