import { webAdminApi } from "@/lib/api-client";

import type {
  ListSaasUsersQuery,
  SaasUserListResponse,
  SaasUserStatusCounts,
} from "../types";

const emptyStatusCounts: SaasUserStatusCounts = {
  active: 0,
  disabled: 0,
  invited: 0,
  suspended: 0,
};

function getQueryNumber(
  query: ListSaasUsersQuery | undefined,
  key: "limit" | "offset",
  fallback: number,
): number {
  if (!query || query instanceof URLSearchParams || Array.isArray(query)) {
    return fallback;
  }

  const value = (query as Record<string, unknown>)[key];

  return typeof value === "number" ? value : fallback;
}

export async function getSaasUserListQuery(
  query?: ListSaasUsersQuery,
): Promise<SaasUserListResponse> {
  const users = await webAdminApi.saas.users.list(query);
  const statusCounts = users.reduce<SaasUserStatusCounts>(
    (counts, user) => ({
      ...counts,
      [user.status]: counts[user.status] + 1,
    }),
    { ...emptyStatusCounts },
  );

  return {
    data: users,
    meta: {
      total: users.length,
      statusCounts,
      limit: getQueryNumber(query, "limit", 50),
      offset: getQueryNumber(query, "offset", 0),
    },
  };
}
