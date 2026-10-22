import type { ApiRequestOptions } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { TenantProfile } from "../types";

type TenantProfileRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export async function getTenantProfileQuery(
  options: TenantProfileRequestOptions = {},
): Promise<TenantProfile> {
  return webAdminApi.tenant.profile.get(options);
}

