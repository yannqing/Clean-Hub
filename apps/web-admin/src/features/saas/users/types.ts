import type {
  QueryParams,
  SaasUserStatus,
  SaasUserSummary,
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
} from "@cleanhub/api-client";

export type ListSaasUsersQuery = QueryParams;

export type SaasUserStatusCounts = Record<SaasUserStatus, number>;

export type SaasUserListResponse = {
  data: SaasUserSummary[];
  meta: {
    total: number;
    statusCounts: SaasUserStatusCounts;
    limit: number;
    offset: number;
  };
};

export type UpdateSaasUserStatusRequest = {
  status: Extract<SaasUserStatus, "active" | "disabled">;
  reason: string;
};
