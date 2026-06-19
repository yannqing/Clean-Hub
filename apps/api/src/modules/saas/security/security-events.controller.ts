import type { AppBindings } from "../../../http/types.js";
import { requireSaasRole } from "../../auth/permission.helper.js";
import { listSecurityEvents } from "./security-events.service.js";
import { securityEventListQuerySchema } from "./security-events.validation.js";

export async function listSecurityEventsController(
  c: import("hono").Context<AppBindings>,
) {
  const authContext = c.get("authContext");

  requireSaasRole(authContext, ["super_admin", "support"]);

  const query = securityEventListQuerySchema.parse({
    severity: c.req.query("severity"),
    eventType: c.req.query("eventType"),
    tenantId: c.req.query("tenantId"),
    dateFrom: c.req.query("dateFrom"),
    dateTo: c.req.query("dateTo"),
    limit: c.req.query("limit"),
    offset: c.req.query("offset"),
  });
  const events = await listSecurityEvents(query);

  return c.json(events);
}
