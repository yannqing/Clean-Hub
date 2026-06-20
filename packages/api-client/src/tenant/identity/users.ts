import type { ApiClient, ApiRequestOptions, QueryParams } from "../../types";
import type {
  CreateTenantUserRequest,
  ResetTenantUserPinRequest,
  ResetTenantUserPinResult,
  TenantUserDetail,
  TenantUserSummary,
  UpdateTenantUserRequest,
} from "./users.types";

export function createTenantUsersApi(client: ApiClient) {
  return {
    list: (
      query?: QueryParams,
      options?: Omit<ApiRequestOptions, "method" | "body" | "query">,
    ) => client.get<TenantUserSummary[]>("/tenant/users", { ...options, query }),
    get: (userId: string) =>
      client.get<TenantUserDetail>(`/tenant/users/${userId}`),
    create: (input: CreateTenantUserRequest) =>
      client.post<TenantUserSummary>("/tenant/users", input),
    update: (userId: string, input: UpdateTenantUserRequest) =>
      client.patch<TenantUserDetail>(`/tenant/users/${userId}`, input),
    disable: (userId: string) =>
      client.patch<void>(`/tenant/users/${userId}/disable`, {}),
    enable: (userId: string) =>
      client.patch<void>(`/tenant/users/${userId}/enable`, {}),
    resetPin: (userId: string, input: ResetTenantUserPinRequest) =>
      client.patch<ResetTenantUserPinResult>(
        `/tenant/users/${userId}/reset-pin`,
        input,
      ),
  };
}
