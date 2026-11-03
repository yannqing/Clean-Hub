import { webAdminApi } from "@/lib/api-client";

import type {
  FeedbackTicketActionResult,
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
    const ticket = await webAdminApi.saas.feedbackTickets.updateAssignee(
      ticketId,
      validation.data,
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
