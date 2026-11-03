import type { Context } from "hono";
import type { AppBindings } from "../../../http/types.js";
import {
  getPosCustomerStatistics,
  getPosOrderStatistics,
  getPosStatisticsOverview,
  getPosTicketStatistics,
} from "./statistics.service.js";
import {
  posStatisticsCustomerQuerySchema,
  posStatisticsQuerySchema,
} from "./statistics.validation.js";

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

export async function getStatisticsOverviewController(c: Context<AppBindings>) {
  const query = posStatisticsQuerySchema.parse(c.req.query());
  const overview = await getPosStatisticsOverview(c.get("authContext"), query);
  return c.json(overview);
}

export async function getTicketStatisticsController(c: Context<AppBindings>) {
  const query = posStatisticsQuerySchema.parse(c.req.query());
  const statistics = await getPosTicketStatistics(c.get("authContext"), query);
  return c.json(statistics);
}

export async function getOrderStatisticsController(c: Context<AppBindings>) {
  const query = posStatisticsQuerySchema.parse(c.req.query());
  const statistics = await getPosOrderStatistics(c.get("authContext"), query);
  return c.json(statistics);
}

export async function getCustomerStatisticsController(c: Context<AppBindings>) {
  const query = posStatisticsCustomerQuerySchema.parse(c.req.query());
  const statistics = await getPosCustomerStatistics(c.get("authContext"), query);
  return c.json(statistics);
}
