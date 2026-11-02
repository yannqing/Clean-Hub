import { localizeErrorMessage } from "../../../http/error-messages.js";
import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { TenantFinanceError } from "./finance.errors.js";
import { getTenantFinanceSummary } from "./finance.service.js";
import { financeSummaryQuerySchema } from "./finance.validation.js";

export async function getTenantFinanceSummaryController(
  c: Context<AppBindings>,
) {
  const query = financeSummaryQuerySchema.parse(c.req.query());

  try {
    return c.json(await getTenantFinanceSummary(c.get("authContext"), query));
  } catch (error) {
    if (error instanceof TenantFinanceError) {
      return c.json(
        {
          message: localizeErrorMessage(error.message, c.get("locale")),
          code: error.code,
          requestId: c.get("requestId"),
        },
        error.status,
      );
    }

    throw error;
  }
}
