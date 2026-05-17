import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import { listFeedbackTicketsController } from "./feedback-tickets.controller.js";

export function createSaasFeedbackTicketRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listFeedbackTicketsController);

  return routes;
}
