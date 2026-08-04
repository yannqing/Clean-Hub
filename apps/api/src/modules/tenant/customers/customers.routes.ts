import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { listTenantCustomersController } from "./customers.controller.js";

export function createTenantCustomerRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantCustomersController);

  return routes;
}
