import type { ApiClient, ApiRequestOptions } from "../types";
import type { TenantOverview } from "./overview.types";

type ApiOptionsWithoutBody = Omit<ApiRequestOptions, "method" | "body">;

export function createTenantOverviewApi(client: ApiClient) {
  return {
    get: (options: ApiOptionsWithoutBody = {}) =>
      client.get<TenantOverview>("/tenant/overview", options),
  };
}
