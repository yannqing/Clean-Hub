import { webAdminApi } from "@/lib/api-client";

import type { FeedbackTicketDetail } from "../types";

export async function getFeedbackTicketDetailQuery(
  ticketId: string,
): Promise<FeedbackTicketDetail> {
  return webAdminApi.saas.feedbackTickets.get(ticketId);
}
