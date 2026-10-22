import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getTenantFinanceSummaryController } from "./finance.controller.js";

export function createTenantFinanceRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/summary", getTenantFinanceSummaryController);

  return routes;
}
