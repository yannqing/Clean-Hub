import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import {
  getTenantNotificationSettings,
  updateTenantNotificationSettings,
} from "./notifications.service.js";
import { updateTenantNotificationSettingsBodySchema } from "./notifications.validation.js";

function getRequestMeta(c: Context<AppBindings>) {
  return {
    ipAddress:
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip"),
    userAgent: c.req.header("user-agent"),
  };
}

export async function getTenantNotificationSettingsController(
  c: Context<AppBindings>,
) {
  return c.json(
    await getTenantNotificationSettings({
      authContext: c.get("authContext"),
    }),
  );
}

export async function updateTenantNotificationSettingsController(
  c: Context<AppBindings>,
) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateTenantNotificationSettingsBodySchema.parse(rawBody);

  return c.json(
    await updateTenantNotificationSettings({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    }),
  );
}
