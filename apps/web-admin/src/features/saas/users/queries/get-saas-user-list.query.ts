import { webAdminApi } from "@/lib/api-client";

import type { SaasUserListResponse, SaasUserStatus } from "../types";

export type GetSaasUserListQueryInput = {
  q?: string;
  status?: SaasUserStatus;
  limit?: number;
  offset?: number;
};

export async function getSaasUserListQuery(
  input: GetSaasUserListQueryInput = {},
): Promise<SaasUserListResponse> {
  return webAdminApi.saas.users.list(input);
}
