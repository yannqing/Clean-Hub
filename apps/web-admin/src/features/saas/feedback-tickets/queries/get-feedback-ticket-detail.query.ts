import type { ApiRequestOptions } from "@cleanhub/api-client";

import { apiClient } from "@/lib/api-client";

import type { FeedbackTicketDetail } from "../types";

type RequestOptions = Omit<ApiRequestOptions, "method" | "body" | "query">;

export async function getFeedbackTicketDetailQuery(
  ticketId: string,
  options: RequestOptions = {},
): Promise<FeedbackTicketDetail> {
  return apiClient<FeedbackTicketDetail>(
    `/saas/feedback-tickets/${encodeURIComponent(ticketId)}`,
    {
      ...options,
      method: "GET",
    },
  );
}
