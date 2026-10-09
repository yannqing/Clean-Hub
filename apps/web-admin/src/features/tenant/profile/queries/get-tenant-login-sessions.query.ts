import type { ApiRequestOptions } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { TenantLoginSession } from "../types";

type TenantLoginSessionsRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export async function getTenantLoginSessionsQuery(
  options: TenantLoginSessionsRequestOptions = {},
): Promise<TenantLoginSession[]> {
  return webAdminApi.tenant.profile.listSessions(options);
}
