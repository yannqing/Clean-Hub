import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  ChangeTenantProfilePasswordRequest,
  ChangeTenantProfilePasswordResult,
  TenantProfile,
  UpdateTenantProfileRequest,
} from "./profile.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

const TENANT_PROFILE_BASE = "/tenant/profile";

export function createTenantProfileApi(client: ApiClient) {
  return {
    get: (options?: RequestOptions) =>
      client.get<TenantProfile>(TENANT_PROFILE_BASE, options),
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

