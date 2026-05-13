import type { ApiClient, QueryParams } from "../types";
import type {
  CreateTenantRequest,
  TenantDetail,
  TenantSummary,
  UpdateTenantRequest,
  UpdateTenantStatusRequest,
} from "./tenants.types";

export function createSaasTenantsApi(client: ApiClient) {
  return {
    list: (query?: QueryParams) =>
      client.get<TenantSummary[]>("/saas/tenants", { query }),
    create: (input: CreateTenantRequest) =>
      client.post<TenantDetail>("/saas/tenants", input),
    get: (tenantId: string) =>
      client.get<TenantDetail>(`/saas/tenants/${tenantId}`),
    update: (tenantId: string, input: UpdateTenantRequest) =>
      client.patch<TenantDetail>(`/saas/tenants/${tenantId}`, input),
    updateStatus: (tenantId: string, input: UpdateTenantStatusRequest) =>
      client.patch<TenantDetail>(`/saas/tenants/${tenantId}/status`, input),
  };
}
