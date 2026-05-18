import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import { FeedbackTicketsError } from "./feedback-tickets.errors.js";
import {
  getFeedbackTicketDetail,
  listFeedbackTickets,
  updateFeedbackTicketAssignee,
  updateFeedbackTicketStatus,
} from "./feedback-tickets.service.js";
import {
  feedbackTicketListQuerySchema,
  feedbackTicketParamsSchema,
  updateFeedbackTicketAssigneeBodySchema,
  updateFeedbackTicketStatusBodySchema,
} from "./feedback-tickets.validation.js";

function getClientIp(c: Context<AppBindings>): string | undefined {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip")
  );
}

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

export async function updateFeedbackTicketAssigneeController(
  c: Context<AppBindings>,
) {
  const params = feedbackTicketParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateFeedbackTicketAssigneeBodySchema.parse(rawBody);

  try {
    const ticket = await updateFeedbackTicketAssignee(
      c.get("authContext"),
      params.ticketId,
      data,
      {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
    );

    return c.json(ticket);
  } catch (error) {
    if (error instanceof FeedbackTicketsError) {
      return createFeedbackTicketsErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateFeedbackTicketStatusController(
  c: Context<AppBindings>,
) {
  const params = feedbackTicketParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateFeedbackTicketStatusBodySchema.parse(rawBody);

  try {
    const ticket = await updateFeedbackTicketStatus(
      c.get("authContext"),
      params.ticketId,
      data,
      {
        ipAddress: getClientIp(c),
        userAgent: c.req.header("user-agent"),
      },
    );

    return c.json(ticket);
  } catch (error) {
    if (error instanceof FeedbackTicketsError) {
      return createFeedbackTicketsErrorResponse(c, error);
    }

    throw error;
  }
}
