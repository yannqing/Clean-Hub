import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getAuditLogController, listAuditLogsController } from "./audit.controller.js";

export function createSaasAuditRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listAuditLogsController);
  routes.get("/:logId", getAuditLogController);

  return routes;
}
