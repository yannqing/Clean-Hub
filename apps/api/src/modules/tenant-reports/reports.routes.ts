import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import { getTenantReportSummaryController } from "./reports.controller.js";

export function createTenantReportRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/summary", getTenantReportSummaryController);

  return routes;
}
