import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { requirePathParam } from "../require-path-param.helper.js";
import {
  bindPosDevice,
  getPosDevice,
  getTerminalState,
  posPinLogin,
  setTerminalLock,
} from "./auth.service.js";
import type {
  BindPosDeviceRequest,
  PosPinLoginRequest,
  SetTerminalLockRequest,
} from "./auth.types.js";

function notImplementedResponse(c: Context<AppBindings>, error: PosNotImplementedError) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

export async function posPinLoginController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = rawBody as PosPinLoginRequest;

  try {
    const result = await posPinLogin({
      requestMeta: getRequestMeta(c),
      data,
    });
    return c.json(result);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
      return notImplementedResponse(c, error);
    }
    throw error;
  }
}

export async function bindPosDeviceController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = rawBody as BindPosDeviceRequest;

  try {
    const device = await bindPosDevice({
      requestMeta: getRequestMeta(c),
      data,
    });
    return c.json(device, 201);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
      return notImplementedResponse(c, error);
    }
    throw error;
  }
}

export async function getPosDeviceController(c: Context<AppBindings>) {
  const deviceId = requirePathParam(c, "deviceId");
  if (deviceId instanceof Response) {
    return deviceId;
  }
  const device = await getPosDevice({ deviceId });
  return c.json(device);
}

export async function setTerminalLockController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = rawBody as SetTerminalLockRequest;

  try {
    const state = await setTerminalLock({
      requestMeta: getRequestMeta(c),
      data,
    });
    return c.json(state);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
      return notImplementedResponse(c, error);
    }
    throw error;
  }
}

export async function getTerminalStateController(c: Context<AppBindings>) {
  const deviceId = requirePathParam(c, "deviceId");
  if (deviceId instanceof Response) {
    return deviceId;
  }
  const state = await getTerminalState({ deviceId });
  return c.json(state);
}
