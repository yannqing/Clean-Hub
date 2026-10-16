import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { AuditError } from "./audit.errors.js";
import { getAuditLogDetail, listAuditLogs } from "./audit.service.js";
import {
  getAuditLogParamsSchema,
  listAuditLogsQuerySchema,
} from "./audit.validation.js";

function createAuditErrorResponse(c: Context<AppBindings>, error: AuditError) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function listAuditLogsController(c: Context<AppBindings>) {
  const query = listAuditLogsQuerySchema.parse(c.req.query());
  const result = await listAuditLogs({ authContext: c.get("authContext"), query });

  return c.json(result);
}

export async function getAuditLogController(c: Context<AppBindings>) {
  const params = getAuditLogParamsSchema.parse(c.req.param());

  try {
    const log = await getAuditLogDetail({
      authContext: c.get("authContext"),
      logId: params.logId,
    });

    return c.json(log);
  } catch (error) {
    if (error instanceof AuditError) {
      return createAuditErrorResponse(c, error);
    }

    throw error;
  }
}
