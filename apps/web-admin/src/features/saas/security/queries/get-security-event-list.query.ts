import { webAdminApi } from "@/lib/api-client";

import type { SecurityEventListItem, SecurityEventListQuery } from "../types";

export async function getSecurityEventListQuery(
  query?: SecurityEventListQuery,
): Promise<SecurityEventListItem[]> {
  return webAdminApi.http.request<SecurityEventListItem[]>(
    "/saas/security/events",
    {
      query,
    },
  );
}
