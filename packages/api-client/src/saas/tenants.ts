import type { ApiClient, QueryParams } from "../types";
import type {
  CreateTenantRequest,
  TenantDetail,
  TenantFeatureFlags,
  TenantListResponse,
  TenantSettings,
  UpdateTenantFeatureFlagsRequest,
  UpdateTenantSettingsRequest,
  UpdateTenantRequest,
  UpdateTenantStatusRequest,
} from "./tenants.types";

export function createSaasTenantsApi(client: ApiClient) {
  return {
    list: (query?: QueryParams) =>
      client.get<TenantListResponse>("/saas/tenants", { query }),
    create: (input: CreateTenantRequest) =>
      client.post<TenantDetail>("/saas/tenants", input),
    get: (tenantId: string) =>
      client.get<TenantDetail>(`/saas/tenants/${tenantId}`),
    update: (tenantId: string, input: UpdateTenantRequest) =>
      client.patch<TenantDetail>(`/saas/tenants/${tenantId}`, input),
    getFeatureFlags: (tenantId: string) =>
      client.get<TenantFeatureFlags>(
        `/saas/tenants/${tenantId}/feature-flags`,
      ),
    updateFeatureFlags: (
      tenantId: string,
      input: UpdateTenantFeatureFlagsRequest,
    ) =>
      client.patch<TenantFeatureFlags>(
        `/saas/tenants/${tenantId}/feature-flags`,
        input,
      ),
    getSettings: (tenantId: string) =>
      client.get<TenantSettings>(`/saas/tenants/${tenantId}/settings`),
    updateSettings: (tenantId: string, input: UpdateTenantSettingsRequest) =>
      client.patch<TenantSettings>(`/saas/tenants/${tenantId}/settings`, input),
    updateStatus: (tenantId: string, input: UpdateTenantStatusRequest) =>
      client.patch<TenantDetail>(`/saas/tenants/${tenantId}/status`, input),
  };
}
