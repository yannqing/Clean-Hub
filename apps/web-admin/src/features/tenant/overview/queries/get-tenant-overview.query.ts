import { webAdminApi } from "@/lib/api-client";

import type { ApiRequestOptions } from "@cleanhub/api-client";
import type { TenantOverview } from "../types";

type TenantOverviewRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export async function getTenantOverviewQuery(
  options: TenantOverviewRequestOptions = {},
): Promise<TenantOverview> {
  return webAdminApi.tenant.overview.get(options);
}
