import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  getTenantAuditLogController,
  listTenantAuditLogsController,
} from "./audit.controller.js";

export function createTenantAuditRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantAuditLogsController);
  routes.get("/:logId", getTenantAuditLogController);

  return routes;
}
