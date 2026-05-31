import type { ApiClient, QueryParams } from "../types";
import type {
  CreateTenantUserRequest,
  ResetTenantUserPinResult,
  TenantUserDetail,
  TenantUserSummary,
  UpdateTenantUserRequest,
} from "./users.types";

export function createTenantUsersApi(client: ApiClient) {
  return {
    list: (query?: QueryParams) =>
      client.get<TenantUserSummary[]>("/tenant/users", { query }),
    get: (userId: string) =>
      client.get<TenantUserDetail>(`/tenant/users/${userId}`),
    create: (input: CreateTenantUserRequest) =>
      client.post<TenantUserSummary>("/tenant/users", input),
    update: (userId: string, input: UpdateTenantUserRequest) =>
      client.patch<TenantUserDetail>(`/tenant/users/${userId}`, input),
    disable: (userId: string) =>
      client.patch<void>(`/tenant/users/${userId}/disable`, {}),
    resetPin: (userId: string) =>
      client.patch<ResetTenantUserPinResult>(
        `/tenant/users/${userId}/reset-pin`,
        {},
      ),
  };
}
