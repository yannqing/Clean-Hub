import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { requireSaasRole } from "../../auth/permission.helper.js";
import { SecurityEventError } from "./security-events.errors.js";
import {
  getSecurityEventDetail,
  listSecurityEvents,
} from "./security-events.service.js";
import {
  getSecurityEventParamsSchema,
  securityEventListQuerySchema,
} from "./security-events.validation.js";

function createSecurityEventErrorResponse(
  c: Context<AppBindings>,
  error: SecurityEventError,
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

export async function listSecurityEventsController(c: Context<AppBindings>) {
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

export async function getSecurityEventController(c: Context<AppBindings>) {
  const authContext = c.get("authContext");

  requireSaasRole(authContext, ["super_admin", "support"]);

  const params = getSecurityEventParamsSchema.parse(c.req.param());

  try {
    const event = await getSecurityEventDetail({
      authContext,
      eventId: params.eventId,
    });

    return c.json(event);
  } catch (error) {
    if (error instanceof SecurityEventError) {
      return createSecurityEventErrorResponse(c, error);
    }

    throw error;
  }
}
