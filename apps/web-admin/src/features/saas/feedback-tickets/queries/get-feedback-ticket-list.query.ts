import { webAdminApi } from "@/lib/api-client";

import type { FeedbackTicketListItem, FeedbackTicketListQuery } from "../types";

export async function getFeedbackTicketListQuery(
  query?: FeedbackTicketListQuery,
): Promise<FeedbackTicketListItem[]> {
  return webAdminApi.http.request<FeedbackTicketListItem[]>(
    "/saas/feedback-tickets",
    {
      query,
    },
  );
}
