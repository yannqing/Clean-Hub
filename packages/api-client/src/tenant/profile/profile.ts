import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  ChangeTenantProfilePasswordRequest,
  ChangeTenantProfilePasswordResult,
  RevokeTenantLoginSessionResult,
  TenantLoginSession,
  TenantProfile,
  UpdateTenantProfileRequest,
} from "./profile.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

const TENANT_PROFILE_BASE = "/tenant/profile";

export function createTenantProfileApi(client: ApiClient) {
  return {
    get: (options?: RequestOptions) =>
      client.get<TenantProfile>(TENANT_PROFILE_BASE, options),
    listSessions: (options?: RequestOptions) =>
      client.get<TenantLoginSession[]>(
        `${TENANT_PROFILE_BASE}/sessions`,
        options,
      ),
    revokeSession: (sessionId: string, options?: RequestOptions) =>
      client.delete<RevokeTenantLoginSessionResult>(
        `${TENANT_PROFILE_BASE}/sessions/${encodeURIComponent(sessionId)}`,
        options,
      ),
    update: (input: UpdateTenantProfileRequest, options?: RequestOptions) =>
      client.patch<TenantProfile>(TENANT_PROFILE_BASE, input, options),
    changePassword: (
      input: ChangeTenantProfilePasswordRequest,
      options?: RequestOptions,
    ) =>
      client.patch<ChangeTenantProfilePasswordResult>(
        `${TENANT_PROFILE_BASE}/password`,
        input,
        options,
      ),
  };
}
