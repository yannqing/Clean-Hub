import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import { TenantAuditError } from "./audit.errors.js";
import {
  getTenantAuditLogDetail,
  listTenantAuditLogs,
} from "./audit.service.js";
import {
  getTenantAuditLogParamsSchema,
  listTenantAuditLogsQuerySchema,
} from "./audit.validation.js";

function createAuditErrorResponse(
  c: Context<AppBindings>,
  error: TenantAuditError,
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

export async function listTenantAuditLogsController(
  c: Context<AppBindings>,
) {
  const query = listTenantAuditLogsQuerySchema.parse(c.req.query());
  const result = await listTenantAuditLogs({
    authContext: c.get("authContext"),
    query,
  });

  return c.json(result);
}

export async function getTenantAuditLogController(c: Context<AppBindings>) {
  const params = getTenantAuditLogParamsSchema.parse(c.req.param());

  try {
    const log = await getTenantAuditLogDetail({
      authContext: c.get("authContext"),
      logId: params.logId,
    });

    return c.json(log);
  } catch (error) {
    if (error instanceof TenantAuditError) {
      return createAuditErrorResponse(c, error);
    }

    throw error;
  }
}
