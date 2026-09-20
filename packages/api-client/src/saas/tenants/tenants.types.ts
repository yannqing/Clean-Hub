export type TenantStatus = "active" | "suspended" | "disabled";
export type TenantLanguage = "en" | "fr" | "zh-CN";

export type TenantErrorCode =
  | "SAAS_TENANT_NOT_FOUND"
  | "SAAS_TENANT_UPDATE_EMPTY"
  | "SAAS_TENANT_STATUS_UNCHANGED"
  | "SAAS_TENANT_SETTINGS_UPDATE_EMPTY"
  | "SAAS_TENANT_FEATURE_FLAGS_UPDATE_EMPTY"
  | "SAAS_TENANT_PRESSING_CODE_CONFLICT"
  | "OWNER_ALREADY_EXISTS"
  | "TENANT_USER_EMAIL_CONFLICT"
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "FORBIDDEN"
  | "TOKEN_INVALID"
  | "TOKEN_EXPIRED"
  | "TOKEN_REUSE_DETECTED"
  | "USER_DISABLED"
  | "USER_SUSPENDED"
  | "AUTH_CONFIG_INVALID"
  | "INTERNAL_SERVER_ERROR";

export type TenantErrorResponse = {
  message: string;
  code: TenantErrorCode | string;
  requestId?: string;
  validationErrors?: unknown;
};

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

/**
 * Offboarding state. Present on a tenant that has left but is still inside its
 * retention window, so the console can show what happened and offer a restore.
 */
export type TenantOffboarding = {
  offboardedAt: string;
  offboardReason: string;
  purgeAfter: string;
};

export type TenantDetail = TenantSummary & {
  defaultLanguage: TenantLanguage;
  defaultCurrency: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  userCount: number;
  /** Null while the tenant is active. */
  offboarding: TenantOffboarding | null;
};

export type OffboardTenantRequest = {
  reason: string;
  retentionDays?: number;
};

/**
 * Offboarding returns the updated tenant plus how many tables the automatic
 * pre-offboarding export covered, so the console can confirm the data was
 * captured before access was cut. The archive itself is downloaded separately.
 */
export type OffboardTenantResponse = {
  tenant: TenantDetail;
  exportedTables: number;
};

export type RestoreTenantRequest = {
  reason: string;
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
  initialOwner?: {
    displayName: string;
    email: string;
    phone?: string;
    password: string;
    pin: string;
  };
};

export type CreateTenantResponse = TenantDetail & {
  initialOwnerUserId?: string;
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
  emailEnabled: boolean;
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
  emailEnabled?: boolean;
};
