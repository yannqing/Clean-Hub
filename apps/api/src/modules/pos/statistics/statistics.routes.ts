import { Hono } from "hono";
import type { AppBindings } from "../../../http/types.js";
import {
  getCustomerStatisticsController,
  getOrderStatisticsController,
  getStatisticsOverviewController,
  getTicketStatisticsController,
} from "./statistics.controller.js";

/**
 * POS statistics routes.
 *
 * Aggregated statistics endpoints for orders, tickets, and customers.
 */
export function createPosStatisticsRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/overview", getStatisticsOverviewController);
  routes.get("/tickets", getTicketStatisticsController);
  routes.get("/orders", getOrderStatisticsController);
  routes.get("/customers", getCustomerStatisticsController);

  return routes;
}
