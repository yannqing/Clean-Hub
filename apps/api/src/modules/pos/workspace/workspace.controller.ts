import type { Context } from "hono";
import type { AppBindings } from "../../../http/types.js";
import {
  getPosPendingTasks,
  getPosRecentActivities,
  getPosWorkspaceOverview,
} from "./workspace.service.js";
import {
  posWorkspaceActivitiesQuerySchema,
  posWorkspaceOverviewQuerySchema,
  posWorkspaceTasksQuerySchema,
} from "./workspace.validation.js";

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

export async function getWorkspaceOverviewController(c: Context<AppBindings>) {
  const query = posWorkspaceOverviewQuerySchema.parse(c.req.query());
  const overview = await getPosWorkspaceOverview(c.get("authContext"), query);
  return c.json(overview);
}

export async function getRecentActivitiesController(c: Context<AppBindings>) {
  const query = posWorkspaceActivitiesQuerySchema.parse(c.req.query());
  const activities = await getPosRecentActivities(c.get("authContext"), query);
  return c.json(activities);
}

export async function getPendingTasksController(c: Context<AppBindings>) {
  const query = posWorkspaceTasksQuerySchema.parse(c.req.query());
  const tasks = await getPosPendingTasks(c.get("authContext"), query);
  return c.json(tasks);
}
