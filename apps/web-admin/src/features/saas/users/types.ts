import type {
  QueryParams,
  SaasUserStatus,
} from "@cleanhub/api-client";

export type {
  AuthContext,
  ResetSaasUserPasswordResult,
  SaasRoleSummary,
  SaasUserDetail,
  SaasUserLanguage,
  SaasUserRoleCode,
  SaasUserStatus,
  SaasUserSummary,
  SaasUserStats,
} from "@cleanhub/api-client";

export type ListSaasUsersQuery = QueryParams;

export type SaasUserStatusCounts = Record<SaasUserStatus, number>;

export type UpdateSaasUserStatusRequest = {
  status: Extract<SaasUserStatus, "active" | "disabled">;
  reason: string;
};
