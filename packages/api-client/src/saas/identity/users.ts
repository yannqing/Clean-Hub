import type { ApiClient, QueryParams } from "../../types";
import type {
  CreateSaasUserRequest,
  ResetSaasUserPasswordRequest,
  ResetSaasUserPasswordResult,
  SaasUserDetail,
  SaasUserSummary,
  SaasUserStats,
  UpdateSaasUserRequest,
  UpdateSaasUserRolesRequest,
  UpdateSaasUserStatusRequest,
} from "./users.types";

export function createSaasUsersApi(client: ApiClient) {
  const getSaasUsers = (query?: QueryParams) =>
    client.get<SaasUserSummary[]>("/saas/users", { query });
  const getSaasUser = (userId: string) =>
    client.get<SaasUserDetail>(`/saas/users/${encodeURIComponent(userId)}`);
  const createSaasUser = (input: CreateSaasUserRequest) =>
    client.post<SaasUserSummary>("/saas/users", input);
  const updateSaasUser = (userId: string, input: UpdateSaasUserRequest) =>
    client.patch<SaasUserDetail>(
      `/saas/users/${encodeURIComponent(userId)}`,
      input,
    );
  const updateSaasUserStatus = (
    userId: string,
    input: UpdateSaasUserStatusRequest,
  ) =>
    client.patch<SaasUserDetail>(
      `/saas/users/${encodeURIComponent(userId)}/status`,
      input,
    );
  const updateSaasUserRoles = (
    userId: string,
    input: UpdateSaasUserRolesRequest,
  ) =>
    client.patch<SaasUserDetail>(
      `/saas/users/${encodeURIComponent(userId)}/roles`,
      input,
    );
  const resetSaasUserPassword = (
    userId: string,
    input: ResetSaasUserPasswordRequest,
  ) =>
    client.patch<ResetSaasUserPasswordResult>(
      `/saas/users/${encodeURIComponent(userId)}/reset-password`,
      input,
    );

  return {
    createSaasUser,
    getSaasUser,
    getSaasUsers,
    get: (userId: string) => getSaasUser(userId),
    list: (query?: QueryParams) => getSaasUsers(query),
    stats: (query?: { q?: string }) =>
      client.get<SaasUserStats>("/saas/users/stats", { query }),
    update: (userId: string, input: UpdateSaasUserRequest) =>
      updateSaasUser(userId, input),
    updateStatus: (userId: string, input: UpdateSaasUserStatusRequest) =>
      updateSaasUserStatus(userId, input),
    updateRoles: (userId: string, input: UpdateSaasUserRolesRequest) =>
      updateSaasUserRoles(userId, input),
    resetPassword: (userId: string, input: ResetSaasUserPasswordRequest) =>
      resetSaasUserPassword(userId, input),
    updateSaasUser,
    updateSaasUserRoles,
    updateSaasUserStatus,
    resetSaasUserPassword,
  };
}
