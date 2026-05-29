import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import { getTenantReportSummary } from "./reports.service.js";
import { reportSummaryQuerySchema } from "./reports.validation.js";

export async function getTenantReportSummaryController(c: Context<AppBindings>) {
  const query = reportSummaryQuerySchema.parse(c.req.query());
  const summary = await getTenantReportSummary(c.get("authContext"), query);

  return c.json(summary);
}
