import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getRequestMeta } from "../request-meta.helper.js";
import {
  authorizeManualDrawerOpen,
  authorizePrivilegedReprint,
  listPosHardwareDevices,
  recordPosPrintJobResult,
} from "./hardware.service.js";
import {
  authorizeManualDrawerOpenBodySchema,
  authorizePrivilegedReprintBodySchema,
  recordPosPrintJobResultBodySchema,
} from "./hardware.validation.js";

/**
 * GET /pos/hardware-devices
 *
 * Returns the list of active hardware devices for the current POS user's
 * branch. Read-only — POS terminals cannot create/update/delete devices.
 */
export async function listHardwareDevicesController(
  c: Context<AppBindings>,
) {
  const devices = await listPosHardwareDevices(c.get("authContext"));
  return c.json({ data: devices });
}

export async function authorizeManualDrawerOpenController(
  c: Context<AppBindings>,
) {
  const data = authorizeManualDrawerOpenBodySchema.parse(await c.req.json());
  const authorization = await authorizeManualDrawerOpen({
    authContext: c.get("authContext"),
    requestMeta: getRequestMeta(c),
    data,
  });
  return c.json(authorization);
}

export async function authorizePrivilegedReprintController(
  c: Context<AppBindings>,
) {
  const data = authorizePrivilegedReprintBodySchema.parse(await c.req.json());
  const authorization = await authorizePrivilegedReprint({
    authContext: c.get("authContext"),
    requestMeta: getRequestMeta(c),
    data,
  });
  return c.json(authorization);
}

export async function recordPosPrintJobResultController(
  c: Context<AppBindings>,
) {
  const data = recordPosPrintJobResultBodySchema.parse(await c.req.json());
  const result = await recordPosPrintJobResult({
    authContext: c.get("authContext"),
    requestMeta: getRequestMeta(c),
    data,
  });
  return c.json(result);
}
