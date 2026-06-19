import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getPlatformSettings, updatePlatformSettings } from "./platform-settings.service.js";
import { updatePlatformSettingsBodySchema } from "./platform-settings.validation.js";

function getClientIp(c: Context<AppBindings>): string | undefined {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("x-real-ip")
  );
}

export async function getPlatformSettingsController(c: Context<AppBindings>) {
  const settings = await getPlatformSettings({ authContext: c.get("authContext") });

  return c.json(settings);
}

export async function updatePlatformSettingsController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updatePlatformSettingsBodySchema.parse(rawBody);

  const settings = await updatePlatformSettings({
    authContext: c.get("authContext"),
    requestMeta: {
      ipAddress: getClientIp(c),
      userAgent: c.req.header("user-agent"),
    },
    data,
  });

  return c.json(settings);
}
