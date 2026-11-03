import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";
import { getPosOverview } from "./overview.service.js";
import type { PosOverviewQuery } from "./overview.types.js";
import { localizeErrorMessage } from "../../../http/error-messages.js";

export async function getPosOverviewController(c: Context<AppBindings>) {
  const query = c.req.query() as PosOverviewQuery;

  try {
    const overview = await getPosOverview({
      authContext: c.get("authContext"),
      query,
    });
    return c.json(overview);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
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
