import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  changePosAccountStatusController,
  changePosProfileStatusController,
  createPosAccountController,
  createPosProfileUnderAccountController,
  deletePosAccountController,
  deletePosProfileController,
  getPosAccountController,
  getPosCustomerOrderStatsController,
  getPosProfileController,
  getPosProfilesByAccountController,
  listPosCustomerServiceItemsController,
  listPosCustomersController,
  updatePosAccountController,
  updatePosProfileController,
} from "./customers.controller.js";

/**
 * Hybrid customer search + profile-scoped operations. Mounted at `/pos/customers`.
 *
 * A customer account owns one or more customer profiles. The list endpoint
 * searches across both; profile read/write/delete live here, while account
 * read/write/delete live under `/pos/accounts` (see createPosAccountsRoutes).
 */
export function createPosCustomersRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listPosCustomersController);
  routes.get("/:customerId/order-stats", getPosCustomerOrderStatsController);
  routes.get(
    "/:customerId/service-items",
    listPosCustomerServiceItemsController,
  );
  routes.get("/:customerId", getPosProfileController);
  routes.patch("/:customerId", updatePosProfileController);
  routes.post("/:customerId/status-changes", changePosProfileStatusController);
  routes.delete("/:customerId", deletePosProfileController);

  return routes;
}

/**
 * Customer account operations. Mounted at `/pos/accounts`. Creating a profile
 * under an account is nested (`POST /:accountId/customers`).
 */
export function createPosAccountsRoutes() {
  const routes = new Hono<AppBindings>();

  routes.post("/", createPosAccountController);
  routes.get("/:accountId", getPosAccountController);
  routes.get("/:accountId/customers", getPosProfilesByAccountController);
  routes.post("/:accountId/customers", createPosProfileUnderAccountController);
  routes.patch("/:accountId", updatePosAccountController);
  routes.post("/:accountId/status-changes", changePosAccountStatusController);
  routes.delete("/:accountId", deletePosAccountController);

  return routes;
}
