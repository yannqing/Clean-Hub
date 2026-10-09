import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";

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
  pressingCode?: string;
  country: string;
  city?: string;
  defaultLanguage?: SaasTenantLanguage;
  defaultCurrency?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  status?: SaasTenantStatus;
  featureFlags?: UpdateSaasTenantFeatureFlagsRequest;
  initialOwner?: {
    displayName: string;
    email: string;
    phone?: string;
  };
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
  emailEnabled: boolean;
  customerOtpEnabled: boolean;
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
  emailEnabled?: boolean;
  customerOtpEnabled?: boolean;
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

/**
 * Offboarding state. Present on a tenant that has left but is still inside its
 * retention window, so the console can show what happened and offer a restore.
 */
export type SaasTenantOffboarding = {
  offboardedAt: string;
  offboardReason: string;
  purgeAfter: string;
};

export type SaasTenantDetail = SaasTenantListItem & {
  defaultLanguage: SaasTenantLanguage;
  defaultCurrency: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  userCount: number;
  readiness: {
    activeOwnerCount: number;
    activeBranchCount: number;
    activeCatalogItemCount: number;
    enrolledTerminalCount: number;
    taxEnabled: boolean;
    taxTemplateApplied: boolean;
    taxRegistrationNumberSet: boolean;
  };
  /** Null while the tenant is active. */
  offboarding: SaasTenantOffboarding | null;
};

export type OffboardSaasTenantRequest = {
  reason: string;
  /** Days of data retention before the purge job may delete the tenant. */
  retentionDays?: number;
};

export type OffboardSaasTenantInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  tenantId: string;
  data: OffboardSaasTenantRequest;
};

export type RestoreSaasTenantRequest = {
  reason: string;
};

export type RestoreSaasTenantInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  tenantId: string;
  data: RestoreSaasTenantRequest;
};

export type ExportSaasTenantInput = {
  authContext: AuthContext;
  requestMeta?: AuthRequestMeta;
  tenantId: string;
};

export type SaasTenantExport = {
  fileName: string;
  content: Uint8Array;
  /** Tables written into the archive, in the order they were exported. */
  tables: string[];
};

export type CreateSaasTenantResult = SaasTenantDetail & {
  initialOwnerUserId?: string;
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

export type ListSaasTenantUsersInput = {
  authContext: AuthContext;
  tenantId: string;
};

export type ResetSaasTenantUserPasswordInput = {
  authContext: AuthContext;
  tenantId: string;
  userId: string;
  reason: string;
  requestMeta?: AuthRequestMeta;
};

export type ResetSaasTenantUserPasswordResult = {
  userId: string;
  temporaryPassword: string;
};
