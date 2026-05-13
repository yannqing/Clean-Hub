import type { ApiClient, QueryParams } from "../types";
import type { TenantUserSummary } from "./users.types";

export function createTenantUsersApi(client: ApiClient) {
  return {
    list: (query?: QueryParams) =>
      client.get<TenantUserSummary[]>("/tenant/users", { query }),
  };
}
