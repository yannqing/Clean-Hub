import type { AppBindings } from "../../http/types.js";
import { requireSaasRole } from "../auth/permission.helper.js";
import { listOperationLogs } from "./operation-logs.service.js";
import { operationLogListQuerySchema } from "./operation-logs.validation.js";

export async function listOperationLogsController(
  c: import("hono").Context<AppBindings>,
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
