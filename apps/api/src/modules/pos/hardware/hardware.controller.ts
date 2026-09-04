import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { PosHardwareError } from "./hardware.errors.js";
import {
  authorizeManualDrawerOpen,
  authorizePrivilegedReprint,
  bindPosPrinter,
  listPosHardwareDevices,
  recordCashPaymentDrawerResult,
  recordPosPrintJobResult,
} from "./hardware.service.js";
import {
  authorizeManualDrawerOpenBodySchema,
  authorizePrivilegedReprintBodySchema,
  bindPosPrinterBodySchema,
  posHardwareDeviceParamsSchema,
  recordCashPaymentDrawerResultBodySchema,
  recordPosPrintJobResultBodySchema,
} from "./hardware.validation.js";

function createPosHardwareErrorResponse(
  c: Context<AppBindings>,
  error: PosHardwareError,
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

/**
 * GET /pos/hardware-devices
 *
 * Returns the active peripherals bound to the current POS terminal.
 * Device lifecycle is admin-only. Local printer binding has a dedicated
 * Owner/Manager endpoint below.
 */
export async function listHardwareDevicesController(c: Context<AppBindings>) {
  const devices = await listPosHardwareDevices(c.get("authContext"));
  return c.json({ data: devices });
}

export async function bindPosPrinterController(c: Context<AppBindings>) {
  const params = posHardwareDeviceParamsSchema.parse(c.req.param());
  const data = bindPosPrinterBodySchema.parse(await c.req.json());

  try {
    return c.json(
      await bindPosPrinter({
        authContext: c.get("authContext"),
        hardwareId: params.hardwareId,
        requestMeta: getRequestMeta(c),
        data,
      }),
    );
  } catch (error) {
    if (error instanceof PosHardwareError) {
      return createPosHardwareErrorResponse(c, error);
    }
    throw error;
  }
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

export async function recordCashPaymentDrawerResultController(
  c: Context<AppBindings>,
) {
  const data = recordCashPaymentDrawerResultBodySchema.parse(
    await c.req.json(),
  );
  const result = await recordCashPaymentDrawerResult({
    authContext: c.get("authContext"),
    requestMeta: getRequestMeta(c),
    data,
  });
  return c.json(result);
}
