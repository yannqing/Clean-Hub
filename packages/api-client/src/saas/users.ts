import type { ApiClient, QueryParams } from "../types";
import type { SaasUserSummary } from "./users.types";

export function createSaasUsersApi(client: ApiClient) {
  const getSaasUsers = (query?: QueryParams) =>
    client.get<SaasUserSummary[]>("/saas/users", { query });

  return {
    getSaasUsers,
    list: (query?: QueryParams) => getSaasUsers(query),
    test: () => client.get<SaasUserSummary>("/saas/test/user"),
  };
}
