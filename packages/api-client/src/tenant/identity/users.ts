import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  CreateTenantUserRequest,
  ResetTenantUserPasswordRequest,
  ResetTenantUserPinRequest,
  TenantUserDetail,
  TenantUserListQuery,
  TenantUserSummary,
  UpdateTenantUserRequest,
  UpdateTenantUserStatusRequest,
} from "./users.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createTenantUsersApi(client: ApiClient) {
  return {
    list: (query?: TenantUserListQuery, options?: RequestOptions) =>
      client.get<TenantUserSummary[]>("/tenant/users", { ...options, query }),
    get: (userId: string, options?: RequestOptions) =>
      client.get<TenantUserDetail>(
        `/tenant/users/${encodeURIComponent(userId)}`,
        options,
      ),
    create: (input: CreateTenantUserRequest, options?: RequestOptions) =>
      client.post<TenantUserSummary>("/tenant/users", input, options),
    update: (
      userId: string,
      input: UpdateTenantUserRequest,
      options?: RequestOptions,
    ) =>
      client.patch<TenantUserDetail>(
        `/tenant/users/${encodeURIComponent(userId)}`,
        input,
        options,
      ),
    updateStatus: (
      userId: string,
      input: UpdateTenantUserStatusRequest,
      options?: RequestOptions,
    ) =>
      client.patch<TenantUserDetail>(
        `/tenant/users/${encodeURIComponent(userId)}/status`,
        input,
        options,
      ),
    resetPin: (
      userId: string,
      input: ResetTenantUserPinRequest,
      options?: RequestOptions,
    ) =>
      client.patch<void>(
        `/tenant/users/${encodeURIComponent(userId)}/pin`,
        input,
        options,
      ),
    resetPassword: (
      userId: string,
      input: ResetTenantUserPasswordRequest,
      options?: RequestOptions,
    ) =>
      client.patch<void>(
        `/tenant/users/${encodeURIComponent(userId)}/password`,
        input,
        options,
      ),
  };
}
