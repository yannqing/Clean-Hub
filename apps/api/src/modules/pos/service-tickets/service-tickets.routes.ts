import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import type { NotificationPublisher } from "../../notifications/index.js";
import {
  changeServiceTicketItemStatusController,
  changeServiceTicketStatusController,
  createServiceTicketController,
  createServiceTicketItemController,
  deleteServiceTicketController,
  deleteServiceTicketItemController,
  getServiceTicketController,
  getServiceTicketOverviewController,
  getServiceTicketRelatedOrdersController,
  listServiceTicketsController,
  updateServiceTicketController,
  updateServiceTicketItemController,
} from "./service-tickets.controller.js";

/**
 * POS service ticket (work order) routes.
 *
 * Mounted at `/pos/service-tickets` (see `pos.routes.ts`). The order in which
 * routes are registered matters — specific paths (`/overview`,
 * `/:ticketId/orders`, `/:ticketId/items`, `/:ticketId/status-changes`) must
 * be declared before the generic `/:ticketId` so Hono's first-match router
 * picks them up.
 */
export type CreatePosServiceTicketsRoutesOptions = {
  notificationPublisher?: NotificationPublisher;
};

export function createPosServiceTicketsRoutes({
  notificationPublisher,
}: CreatePosServiceTicketsRoutesOptions = {}) {
  const routes = new Hono<AppBindings>();

  routes.get("/", listServiceTicketsController);
  routes.post("/", createServiceTicketController);
  routes.get("/overview", getServiceTicketOverviewController);

  routes.get("/:ticketId", getServiceTicketController);
  routes.patch("/:ticketId", updateServiceTicketController);
  routes.delete("/:ticketId", deleteServiceTicketController);
  routes.post(
    "/:ticketId/status-changes",
    changeServiceTicketStatusController({ notificationPublisher }),
  );
  routes.get("/:ticketId/orders", getServiceTicketRelatedOrdersController);

  routes.post("/:ticketId/items", createServiceTicketItemController);
  routes.patch("/:ticketId/items/:itemId", updateServiceTicketItemController);
  routes.post(
    "/:ticketId/items/:itemId/status-changes",
    changeServiceTicketItemStatusController,
  );
  routes.delete("/:ticketId/items/:itemId", deleteServiceTicketItemController);

  return routes;
}
