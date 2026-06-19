import { Hono } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createBackupJobController,
  createRestoreRequestController,
  listBackupJobsController,
  listRestoreRequestsController,
} from "./backups.controller.js";

export function createSaasBackupRoutes() {
  const routes = new Hono<AppBindings>();

  routes.post("/:backupId/restore-requests", createRestoreRequestController);
  routes.get("/", listBackupJobsController);
  routes.post("/", createBackupJobController);

  return routes;
}

export function createSaasRestoreRequestRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/", listRestoreRequestsController);

  return routes;
}
