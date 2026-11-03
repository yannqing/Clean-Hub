import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  getOperationLogController,
  listOperationLogsController,
} from "./operation-logs.controller.js";

export function createSaasOperationLogRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listOperationLogsController);
  routes.get("/:logId", getOperationLogController);

  return routes;
}
