import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  getFeedbackTicketController,
  listFeedbackTicketsController,
} from "./feedback-tickets.controller.js";

export function createSaasFeedbackTicketRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listFeedbackTicketsController);
  routes.get("/:ticketId", getFeedbackTicketController);

  return routes;
}
