import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { requireSaasRole } from "../../auth/permission.helper.js";
import { OperationLogError } from "./operation-logs.errors.js";
import {
  getOperationLogDetail,
  listOperationLogs,
} from "./operation-logs.service.js";
import {
  operationLogListQuerySchema,
  operationLogParamsSchema,
} from "./operation-logs.validation.js";

function createOperationLogErrorResponse(
  c: Context<AppBindings>,
  error: OperationLogError,
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

export async function listOperationLogsController(
  c: Context<AppBindings>,
) {
  const authContext = c.get("authContext");

  requireSaasRole(authContext, ["super_admin", "support"]);

  const query = operationLogListQuerySchema.parse({
    level: c.req.query("level"),
    service: c.req.query("service"),
    tenantId: c.req.query("tenantId"),
    dateFrom: c.req.query("dateFrom"),
    dateTo: c.req.query("dateTo"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const logs = await listOperationLogs(query);

  return c.json(logs);
}

export async function getOperationLogController(c: Context<AppBindings>) {
  const authContext = c.get("authContext");

  requireSaasRole(authContext, ["super_admin", "support"]);

  const params = operationLogParamsSchema.parse(c.req.param());

  try {
    return c.json(await getOperationLogDetail(params.logId));
  } catch (error) {
    if (error instanceof OperationLogError) {
      return createOperationLogErrorResponse(c, error);
    }

    throw error;
  }
}
