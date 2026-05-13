import type { ApiClient, QueryParams } from "../types";
import type { SaasUserSummary } from "./users.types";

export function createSaasUsersApi(client: ApiClient) {
  return {
    list: (query?: QueryParams) =>
      client.get<SaasUserSummary[]>("/saas/users", { query }),
    test: () =>
        client.get<SaasUserSummary>("/saas/test/user"),
  };
}
