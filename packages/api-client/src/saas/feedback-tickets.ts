import type { ApiClient } from "../types";
import type {
  FeedbackTicketDetail,
  FeedbackTicketListItem,
  FeedbackTicketListQuery,
  UpdateFeedbackTicketAssigneeRequest,
  UpdateFeedbackTicketStatusRequest,
} from "./feedback-tickets.types";

export function createSaasFeedbackTicketsApi(client: ApiClient) {
  return {
    list: (query?: FeedbackTicketListQuery) =>
      client.get<FeedbackTicketListItem[]>("/saas/feedback-tickets", {
        query,
      }),
    get: (ticketId: string) =>
      client.get<FeedbackTicketDetail>(`/saas/feedback-tickets/${ticketId}`),
    updateStatus: (
      ticketId: string,
      input: UpdateFeedbackTicketStatusRequest,
    ) =>
      client.patch<FeedbackTicketDetail>(
        `/saas/feedback-tickets/${ticketId}/status`,
        input,
      ),
    updateAssignee: (
      ticketId: string,
      input: UpdateFeedbackTicketAssigneeRequest,
    ) =>
      client.patch<FeedbackTicketDetail>(
        `/saas/feedback-tickets/${ticketId}/assignee`,
        input,
      ),
  };
}
