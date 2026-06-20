import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createPosTicketController,
  getPosTicketController,
  listPosTicketsController,
  updatePosTicketStatusController,
} from "./tickets.controller.js";

/**
 * POS ticket (work order) routes. Scaffold — handlers exist but the service
 * layer throws PosNotImplementedError until the repository is wired up.
 */
export function createPosTicketsRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listPosTicketsController);
  routes.post("/", createPosTicketController);
  routes.get("/:ticketId", getPosTicketController);
  routes.patch("/:ticketId/status", updatePosTicketStatusController);

  return routes;
}
