import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  getSecuritySettings,
  updateSecuritySettings,
} from "./security-settings.service.js";
import { updateSecuritySettingsBodySchema } from "./security-settings.validation.js";

function getClientIp(c: Context<AppBindings>): string | undefined {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip")
  );
}

export async function getSecuritySettingsController(c: Context<AppBindings>) {
  const settings = await getSecuritySettings({
    authContext: c.get("authContext"),
  });

  return c.json(settings);
}

export async function updateSecuritySettingsController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateSecuritySettingsBodySchema.parse(rawBody);
  const settings = await updateSecuritySettings({
    authContext: c.get("authContext"),
    requestMeta: {
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent"),
    },
    data,
  });

  return c.json(settings);
}
