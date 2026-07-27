import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { PosTerminalSettingsError } from "./terminal-settings.errors.js";
import {
  createPosTerminalSettings,
  getPosTerminalSettings,
  heartbeatPosTerminal,
  updatePosTerminalSettings,
} from "./terminal-settings.service.js";
import {
  createTerminalSettingsBodySchema,
  terminalHeartbeatBodySchema,
  updateTerminalSettingsBodySchema,
} from "./terminal-settings.validation.js";

function createErrorResponse(
  c: Context<AppBindings>,
  error: PosTerminalSettingsError,
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

export async function heartbeatTerminalController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = terminalHeartbeatBodySchema.parse(rawBody);

  try {
    return c.json(await heartbeatPosTerminal(c.get("authContext"), data));
  } catch (error) {
    if (error instanceof PosTerminalSettingsError) {
      return createErrorResponse(c, error);
    }

    throw error;
  }
}

// ---------------------------------------------------------------------------
// GET /pos/terminal-settings?deviceId=...
// ---------------------------------------------------------------------------

export async function getTerminalSettingsController(c: Context<AppBindings>) {
  const deviceId = c.req.query("deviceId");

  if (!deviceId) {
    return c.json(
      {
        message: "deviceId query parameter is required.",
        code: "VALIDATION_ERROR",
        requestId: c.get("requestId"),
      },
      400,
    );
  }

  try {
    const settings = await getPosTerminalSettings(
      c.get("authContext"),
      deviceId,
    );
    return c.json(settings);
  } catch (error) {
    if (error instanceof PosTerminalSettingsError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// POST /pos/terminal-settings
// ---------------------------------------------------------------------------

export async function createTerminalSettingsController(
  c: Context<AppBindings>,
) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createTerminalSettingsBodySchema.parse(rawBody);

  try {
    const settings = await createPosTerminalSettings(
      c.get("authContext"),
      data,
      getRequestMeta(c),
    );
    return c.json(settings, 201);
  } catch (error) {
    if (error instanceof PosTerminalSettingsError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// PATCH /pos/terminal-settings?deviceId=...
// ---------------------------------------------------------------------------

export async function updateTerminalSettingsController(
  c: Context<AppBindings>,
) {
  const deviceId = c.req.query("deviceId");

  if (!deviceId) {
    return c.json(
      {
        message: "deviceId query parameter is required.",
        code: "VALIDATION_ERROR",
        requestId: c.get("requestId"),
      },
      400,
    );
  }

  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateTerminalSettingsBodySchema.parse(rawBody);

  try {
    const settings = await updatePosTerminalSettings(
      c.get("authContext"),
      deviceId,
      data,
      getRequestMeta(c),
    );
    return c.json(settings);
  } catch (error) {
    if (error instanceof PosTerminalSettingsError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}
