import type { ApiClient } from "../types";
import type { TenantOverview } from "./overview.types";

export function createTenantOverviewApi(client: ApiClient) {
  return {
    get: () => client.get<TenantOverview>("/tenant/overview"),
  };
}
