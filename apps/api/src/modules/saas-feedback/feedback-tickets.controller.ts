import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import { listFeedbackTickets } from "./feedback-tickets.service.js";
import { feedbackTicketListQuerySchema } from "./feedback-tickets.validation.js";

export async function listFeedbackTicketsController(c: Context<AppBindings>) {
  const query = feedbackTicketListQuerySchema.parse(c.req.query());
  const tickets = await listFeedbackTickets(c.get("authContext"), query);

  return c.json(tickets);
}
