import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { PosTerminalSettingsError } from "./terminal-settings.errors.js";
import {
  getPosTerminalSettings,
  heartbeatPosTerminal,
  updatePosTerminalSettings,
} from "./terminal-settings.service.js";
import {
  terminalHeartbeatBodySchema,
  updateTerminalSettingsBodySchema,
} from "./terminal-settings.validation.js";
import { localizeErrorMessage } from "../../../http/error-messages.js";

function createErrorResponse(
  c: Context<AppBindings>,
  error: PosTerminalSettingsError,
) {
  return c.json(
    {
      message: localizeErrorMessage(error.message, c.get("locale")),
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
// GET /pos/terminal-settings
// ---------------------------------------------------------------------------

export async function getTerminalSettingsController(c: Context<AppBindings>) {
  try {
    const settings = await getPosTerminalSettings(c.get("authContext"));
    return c.json(settings);
  } catch (error) {
    if (error instanceof PosTerminalSettingsError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// PATCH /pos/terminal-settings
// ---------------------------------------------------------------------------

export async function updateTerminalSettingsController(
  c: Context<AppBindings>,
) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateTerminalSettingsBodySchema.parse(rawBody);

  try {
    const settings = await updatePosTerminalSettings(
      c.get("authContext"),
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
