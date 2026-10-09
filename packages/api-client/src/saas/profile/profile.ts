import type { ApiClient, ApiRequestOptions } from "../../types";
import type {
  ChangeSaasProfilePasswordRequest,
  ChangeSaasProfilePasswordResult,
  SaasProfile,
  UpdateSaasProfileRequest,
} from "./profile.types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export function createSaasProfileApi(client: ApiClient) {
  return {
    get: (options: RequestOptions = {}) =>
      client.get<SaasProfile>("/saas/profile", options),
    update: (input: UpdateSaasProfileRequest, options: RequestOptions = {}) =>
      client.patch<SaasProfile>("/saas/profile", input, options),
    changePassword: (
      input: ChangeSaasProfilePasswordRequest,
      options: RequestOptions = {},
    ) =>
      client.patch<ChangeSaasProfilePasswordResult>(
        "/saas/profile/password",
        input,
        options,
      ),
  };
}
