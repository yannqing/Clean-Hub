import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { listOperationLogsController } from "./operation-logs.controller.js";

export function createSaasOperationLogRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listOperationLogsController);

  return routes;
}
