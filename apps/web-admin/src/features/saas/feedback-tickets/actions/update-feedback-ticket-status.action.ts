import { webAdminApi } from "@/lib/api-client";

import type {
  FeedbackTicketActionResult,
  UpdateFeedbackTicketStatusInput,
} from "../types";
import { validateFeedbackTicketStatusUpdate } from "../validators";

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Failed to update feedback ticket status.";
}

export async function updateFeedbackTicketStatusAction(
  ticketId: string,
  input: UpdateFeedbackTicketStatusInput,
): Promise<FeedbackTicketActionResult> {
  const validation = validateFeedbackTicketStatusUpdate(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const ticket = await webAdminApi.saas.feedbackTickets.updateStatus(
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
