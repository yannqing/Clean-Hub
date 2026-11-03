import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createTenantBackupJobController,
  createTenantRestoreRequestController,
  listTenantBackupJobsController,
} from "./backups.controller.js";

export function createTenantBackupRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listTenantBackupJobsController);
  routes.post("/", createTenantBackupJobController);
  routes.post("/:backupId/restore-requests", createTenantRestoreRequestController);

  return routes;
}
