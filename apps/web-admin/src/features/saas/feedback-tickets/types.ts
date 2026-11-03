import type { FeedbackTicketDetail } from "@cleanhub/api-client";

export type {
  FeedbackTicketDetail,
  FeedbackTicketListItem,
  FeedbackTicketListQuery,
  FeedbackTicketStatus,
  UpdateFeedbackTicketAssigneeRequest as UpdateFeedbackTicketAssigneeInput,
  UpdateFeedbackTicketStatusRequest as UpdateFeedbackTicketStatusInput,
} from "@cleanhub/api-client";

export type FeedbackTicketActionResult =
  | {
      ok: true;
      data: FeedbackTicketDetail;
    }
  | {
      ok: false;
      error: string;
    };
