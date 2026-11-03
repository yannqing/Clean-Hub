import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { PosHardwareError } from "./hardware.errors.js";
import {
  authorizeManualDrawerOpen,
  authorizePrivilegedReprint,
  bindPosPrinter,
  connectPosBuiltInHardware,
  listPosHardwareDevices,
  recordCashPaymentDrawerResult,
  recordPosPrintJobResult,
} from "./hardware.service.js";
import {
  authorizeManualDrawerOpenBodySchema,
  authorizePrivilegedReprintBodySchema,
  bindPosPrinterBodySchema,
  connectPosBuiltInHardwareBodySchema,
  posHardwareDeviceParamsSchema,
  recordCashPaymentDrawerResultBodySchema,
  recordPosPrintJobResultBodySchema,
} from "./hardware.validation.js";
import { localizeErrorMessage } from "../../../http/error-messages.js";

function createPosHardwareErrorResponse(
  c: Context<AppBindings>,
  error: PosHardwareError,
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

/**
 * GET /pos/hardware-devices
 *
 * Returns the active peripherals bound to the current POS terminal.
 * Manually configured device lifecycle remains admin-only. Built-in device
 * registration and local printer binding have Owner/Manager endpoints below.
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

export async function connectPosBuiltInHardwareController(
  c: Context<AppBindings>,
) {
  const data = connectPosBuiltInHardwareBodySchema.parse(await c.req.json());

  return c.json(
    await connectPosBuiltInHardware({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    }),
  );
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
