import type { ApiClient, QueryParams } from "../types";
import type { CreateSaasUserRequest, SaasUserSummary } from "./users.types";

export function createSaasUsersApi(client: ApiClient) {
  const getSaasUsers = (query?: QueryParams) =>
    client.get<SaasUserSummary[]>("/saas/users", { query });
  const createSaasUser = (input: CreateSaasUserRequest) =>
    client.post<SaasUserSummary>("/saas/users", input);

  return {
    createSaasUser,
    getSaasUsers,
    list: (query?: QueryParams) => getSaasUsers(query),
    test: () => client.get<SaasUserSummary>("/saas/test/user"),
  };
}
