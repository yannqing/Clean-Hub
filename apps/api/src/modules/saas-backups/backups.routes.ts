import { Hono } from "hono";

import type { AppBindings } from "../../http/types.js";
import { listBackupJobsController } from "./backups.controller.js";

export function createSaasBackupRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listBackupJobsController);

  return routes;
}
