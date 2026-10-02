import { webAdminApi } from "@/lib/api-client";

import type {
  ListSaasUsersQuery,
  SaasUserStats,
  SaasUserSummary,
} from "../types";

export async function getSaasUserListQuery(
  query?: ListSaasUsersQuery,
): Promise<SaasUserSummary[]> {
  return webAdminApi.saas.users.list(query);
}

export async function getSaasUserStatsQuery(q?: string): Promise<SaasUserStats> {
  return webAdminApi.saas.users.stats({ q });
}
