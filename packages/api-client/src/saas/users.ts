import type { ApiClient, QueryParams } from "../types";
import type {
  CreateSaasUserRequest,
  SaasUserListResponse,
  SaasUserSummary,
  UpdateSaasUserRequest,
} from "./users.types";

export function createSaasUsersApi(client: ApiClient) {
  return {
    list: (query?: QueryParams) =>
      client.get<SaasUserListResponse>("/saas/users", { query }),
    create: (input: CreateSaasUserRequest) =>
      client.post<SaasUserSummary>("/saas/users", input),
    update: (userId: string, input: UpdateSaasUserRequest) =>
      client.patch<SaasUserSummary>(`/saas/users/${userId}`, input),
    delete: (userId: string) =>
      client.delete<void>(`/saas/users/${userId}`, { parseAs: "void" }),
    test: () => client.get<SaasUserSummary>("/saas/test/user"),
  };
}
