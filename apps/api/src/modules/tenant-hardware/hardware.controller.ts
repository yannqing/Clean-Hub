import type { Context } from "hono";

import type { AppBindings } from "../../http/types.js";
import { HardwareError } from "./hardware.errors.js";
import {
  createHardwareConfig,
  listHardwareConfigs,
  updateHardwareConfig,
} from "./hardware.service.js";
import {
  createHardwareConfigBodySchema,
  hardwareConfigParamsSchema,
  listHardwareConfigsQuerySchema,
  updateHardwareConfigBodySchema,
} from "./hardware.validation.js";

function getRequestMeta(c: Context<AppBindings>) {
  return {
    ipAddress: c.req.header("x-forwarded-for") ?? c.req.header("cf-connecting-ip"),
    userAgent: c.req.header("user-agent"),
  };
}

function createHardwareErrorResponse(
  c: Context<AppBindings>,
  error: HardwareError,
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

export async function listHardwareConfigsController(
  c: Context<AppBindings>,
) {
  const query = listHardwareConfigsQuerySchema.parse(c.req.query());
  const result = await listHardwareConfigs({
    authContext: c.get("authContext"),
    query,
  });

  return c.json(result);
}

export async function createHardwareConfigController(
  c: Context<AppBindings>,
) {
  const body = createHardwareConfigBodySchema.parse(await c.req.json());

  try {
    const hardware = await createHardwareConfig({
      authContext: c.get("authContext"),
      data: body,
      requestMeta: getRequestMeta(c),
    });

    return c.json(hardware, 201);
  } catch (error) {
    if (error instanceof HardwareError) {
      return createHardwareErrorResponse(c, error);
    }

    throw error;
  }
}

export async function updateHardwareConfigController(
  c: Context<AppBindings>,
) {
  const params = hardwareConfigParamsSchema.parse(c.req.param());
  const body = updateHardwareConfigBodySchema.parse(await c.req.json());

  try {
    const hardware = await updateHardwareConfig({
      authContext: c.get("authContext"),
      hardwareId: params.hardwareId,
      data: body,
      requestMeta: getRequestMeta(c),
    });

    return c.json(hardware);
  } catch (error) {
    if (error instanceof HardwareError) {
      return createHardwareErrorResponse(c, error);
    }

    throw error;
  }
}
