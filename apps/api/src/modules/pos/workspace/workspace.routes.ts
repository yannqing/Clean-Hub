import { Hono } from "hono";
import type { AppBindings } from "../../../http/types.js";
import {
  getPendingTasksController,
  getRecentActivitiesController,
  getWorkspaceOverviewController,
} from "./workspace.controller.js";

/**
 * POS workspace routes.
 *
 * Aggregated workspace endpoints for dashboard, recent activities, and pending tasks.
 */
export function createPosWorkspaceRoutes() {
  const routes = new Hono<AppBindings>();

  routes.get("/overview", getWorkspaceOverviewController);
  routes.get("/recent-activities", getRecentActivitiesController);
  routes.get("/pending-tasks", getPendingTasksController);

  return routes;
}
