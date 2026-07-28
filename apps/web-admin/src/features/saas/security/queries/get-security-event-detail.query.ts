import type { ApiRequestOptions } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { SecurityEventDetail } from "../types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export async function getSecurityEventDetailQuery(
  eventId: string,
  options: RequestOptions = {},
): Promise<SecurityEventDetail> {
  return webAdminApi.saas.securityEvents.get(eventId, options);
}
