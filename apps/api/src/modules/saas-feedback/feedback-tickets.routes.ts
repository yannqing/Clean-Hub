import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  getFeedbackTicketController,
  listFeedbackTicketsController,
  updateFeedbackTicketAssigneeController,
  updateFeedbackTicketStatusController,
} from "./feedback-tickets.controller.js";

export function createSaasFeedbackTicketRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listFeedbackTicketsController);
  routes.patch("/:ticketId/assignee", updateFeedbackTicketAssigneeController);
  routes.patch("/:ticketId/status", updateFeedbackTicketStatusController);
  routes.get("/:ticketId", getFeedbackTicketController);

  return routes;
}
