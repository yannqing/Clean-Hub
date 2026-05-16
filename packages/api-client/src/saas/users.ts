import type { ApiClient, QueryParams } from "../types";
import type {
  CreateSaasUserRequest,
  SaasUserDetail,
  SaasUserSummary,
} from "./users.types";

export function createSaasUsersApi(client: ApiClient) {
  const getSaasUsers = (query?: QueryParams) =>
    client.get<SaasUserSummary[]>("/saas/users", { query });
  const getSaasUser = (userId: string) =>
    client.get<SaasUserDetail>(`/saas/users/${encodeURIComponent(userId)}`);
  const createSaasUser = (input: CreateSaasUserRequest) =>
    client.post<SaasUserSummary>("/saas/users", input);

  return {
    createSaasUser,
    getSaasUser,
    getSaasUsers,
    get: (userId: string) => getSaasUser(userId),
    list: (query?: QueryParams) => getSaasUsers(query),
    test: () => client.get<SaasUserSummary>("/saas/test/user"),
  };
}
