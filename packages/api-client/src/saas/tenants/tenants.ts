import type { ApiClient, ApiRequestOptions, QueryParams } from "../../types";
import type {
  CreateTenantRequest,
  CreateTenantResponse,
  OffboardTenantRequest,
  OffboardTenantResponse,
  RestoreTenantRequest,
  SaasTenantUserSummary,
  SaasTenantTaxSettings,
  UpdateSaasTenantTaxSettingsRequest,
  TenantDetail,
  TenantFeatureFlags,
  TenantListResponse,
  TenantSettings,
  UpdateTenantFeatureFlagsRequest,
  UpdateTenantSettingsRequest,
  UpdateTenantRequest,
  UpdateTenantStatusRequest,
} from "./tenants.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body">;

export function createSaasTenantsApi(client: ApiClient) {
  return {
    list: (query?: QueryParams, options?: RequestOptions) =>
      client.get<TenantListResponse>("/saas/tenants", { ...options, query }),
    create: (input: CreateTenantRequest, options?: RequestOptions) =>
      client.post<CreateTenantResponse>("/saas/tenants", input, options),
    get: (tenantId: string, options?: RequestOptions) =>
      client.get<TenantDetail>(`/saas/tenants/${tenantId}`, options),
    listUsers: (tenantId: string, options?: RequestOptions) =>
      client.get<{ data: SaasTenantUserSummary[] }>(
        `/saas/tenants/${encodeURIComponent(tenantId)}/users`,
        options,
      ),
    update: (
      tenantId: string,
      input: UpdateTenantRequest,
      options?: RequestOptions,
    ) =>
      client.patch<TenantDetail>(
        `/saas/tenants/${tenantId}`,
        input,
        options,
      ),
    getFeatureFlags: (tenantId: string, options?: RequestOptions) =>
      client.get<TenantFeatureFlags>(
        `/saas/tenants/${tenantId}/feature-flags`,
        options,
      ),
    updateFeatureFlags: (
      tenantId: string,
      input: UpdateTenantFeatureFlagsRequest,
      options?: RequestOptions,
    ) =>
      client.patch<TenantFeatureFlags>(
        `/saas/tenants/${tenantId}/feature-flags`,
        input,
        options,
      ),
    getSettings: (tenantId: string, options?: RequestOptions) =>
      client.get<TenantSettings>(
        `/saas/tenants/${tenantId}/settings`,
        options,
      ),
    getTaxSettings: (tenantId: string, options?: RequestOptions) =>
      client.get<SaasTenantTaxSettings>(`/saas/tenants/${tenantId}/tax-settings`, options),
    updateTaxSettings: (tenantId: string, input: UpdateSaasTenantTaxSettingsRequest, options?: RequestOptions) =>
      client.patch<SaasTenantTaxSettings>(`/saas/tenants/${tenantId}/tax-settings`, input, options),
    applyTaxTemplate: (tenantId: string, version: number, options?: RequestOptions) =>
      client.post<SaasTenantTaxSettings>(`/saas/tenants/${tenantId}/tax-template/apply`, { version }, options),
    updateSettings: (
      tenantId: string,
      input: UpdateTenantSettingsRequest,
      options?: RequestOptions,
    ) =>
      client.patch<TenantSettings>(
        `/saas/tenants/${tenantId}/settings`,
        input,
        options,
      ),
    updateStatus: (
      tenantId: string,
      input: UpdateTenantStatusRequest,
      options?: RequestOptions,
    ) =>
      client.patch<TenantDetail>(
        `/saas/tenants/${tenantId}/status`,
        input,
        options,
      ),
    /** Start the retention countdown; reversible until `purgeAfter`. */
    offboard: (
      tenantId: string,
      input: OffboardTenantRequest,
      options?: RequestOptions,
    ) =>
      client.post<OffboardTenantResponse>(
        `/saas/tenants/${tenantId}/offboarding`,
        input,
        options,
      ),
    /**
     * Download the tenant's data as a zip of CSVs.
     *
     * `parseAs: "blob"` is explicit rather than relying on content-type
     * sniffing, so the archive is never run through `response.json()`.
     */
    exportArchive: (tenantId: string, options?: RequestOptions) =>
      client.get<Blob>(`/saas/tenants/${tenantId}/export`, {
        ...options,
        parseAs: "blob",
      }),
    /** Cancel an offboarding while the tenant is still inside its window. */
    restore: (
      tenantId: string,
      input: RestoreTenantRequest,
      options?: RequestOptions,
    ) =>
      client.post<TenantDetail>(
        `/saas/tenants/${tenantId}/offboarding/restore`,
        input,
        options,
      ),
  };
}
