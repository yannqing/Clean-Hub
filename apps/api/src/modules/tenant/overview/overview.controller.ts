import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { TenantOverviewError } from "./overview.errors.js";
import { getTenantOverview } from "./overview.service.js";

function createTenantOverviewErrorResponse(
  c: Context<AppBindings>,
  error: TenantOverviewError,
) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function getTenantOverviewController(c: Context<AppBindings>) {
  try {
    const overview = await getTenantOverview({
      authContext: c.get("authContext"),
    });

    return c.json(overview);
  } catch (error) {
    if (error instanceof TenantOverviewError) {
      return createTenantOverviewErrorResponse(c, error);
    }

    throw error;
  }
}
