import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import { FeedbackTicketsError } from "./feedback-tickets.errors.js";
import {
  getFeedbackTicketDetail,
  listFeedbackTickets,
} from "./feedback-tickets.service.js";
import {
  feedbackTicketListQuerySchema,
  feedbackTicketParamsSchema,
} from "./feedback-tickets.validation.js";

function createFeedbackTicketsErrorResponse(
  c: Context<AppBindings>,
  error: FeedbackTicketsError,
) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function listFeedbackTicketsController(c: Context<AppBindings>) {
  const query = feedbackTicketListQuerySchema.parse(c.req.query());
  const tickets = await listFeedbackTickets(c.get("authContext"), query);

  return c.json(tickets);
}

export async function getFeedbackTicketController(c: Context<AppBindings>) {
  const params = feedbackTicketParamsSchema.parse(c.req.param());

  try {
    const ticket = await getFeedbackTicketDetail(
      c.get("authContext"),
      params.ticketId,
    );

    return c.json(ticket);
  } catch (error) {
    if (error instanceof FeedbackTicketsError) {
      return createFeedbackTicketsErrorResponse(c, error);
    }

    throw error;
  }
}
