import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createPosCustomerController,
  getPosCustomerController,
  listPosCustomersController,
} from "./customers.controller.js";

/**
 * POS customer management routes. Scaffold — handlers exist but the service
 * layer throws PosNotImplementedError until the repository is wired up.
 */
export function createPosCustomersRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listPosCustomersController);
  routes.post("/", createPosCustomerController);
  routes.get("/:customerId", getPosCustomerController);

  return routes;
}
