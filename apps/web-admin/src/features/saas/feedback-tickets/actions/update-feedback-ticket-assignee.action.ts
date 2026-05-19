import { webAdminApi } from "@/lib/api-client";

import type {
  FeedbackTicketActionResult,
  FeedbackTicketDetail,
  UpdateFeedbackTicketAssigneeInput,
} from "../types";
import { validateFeedbackTicketAssigneeUpdate } from "../validators";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to update feedback ticket assignee.";
}

export async function updateFeedbackTicketAssigneeAction(
  ticketId: string,
  input: UpdateFeedbackTicketAssigneeInput,
): Promise<FeedbackTicketActionResult> {
  const validation = validateFeedbackTicketAssigneeUpdate(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const ticket = await webAdminApi.http.request<FeedbackTicketDetail>(
      `/saas/feedback-tickets/${ticketId}/assignee`,
      {
        method: "PATCH",
        body: validation.data,
      },
    );

    return {
      ok: true,
      data: ticket,
    };
  } catch (error) {
    return {
      ok: false,
      error: getErrorMessage(error),
    };
  }
}
