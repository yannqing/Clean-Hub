import type { ApiClient, ApiRequestOptions, QueryParams } from "../../types";
import type {
  CreateTenantRequest,
  CreateTenantResponse,
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
  };
}
