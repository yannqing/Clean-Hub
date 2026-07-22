import type { Context } from "hono";

import { appendSetCookieHeaders } from "../../../http/response.js";
import type { AppBindings } from "../../../http/types.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { requirePathParam } from "../require-path-param.helper.js";
import { PosTerminalAuthError } from "./auth.errors.js";
import {
  bindPosDevice,
  getPosDevice,
  getTerminalState,
  rotatePosDeviceCredential,
  setTerminalLock,
  updatePosDevice,
} from "./auth.service.js";
import {
  bindPosDeviceBodySchema,
  rotatePosDeviceCredentialBodySchema,
  setTerminalLockBodySchema,
  updatePosDeviceBodySchema,
} from "./auth.validation.js";

function terminalErrorResponse(
  c: Context<AppBindings>,
  error: PosTerminalAuthError,
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

async function runTerminalAction<T>(
  c: Context<AppBindings>,
  action: () => Promise<T>,
): Promise<T | Response> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof PosTerminalAuthError) {
      return terminalErrorResponse(c, error);
    }
    throw error;
  }
}

export async function bindPosDeviceController(c: Context<AppBindings>) {
  const data = bindPosDeviceBodySchema.parse(await c.req.json());
  const result = await runTerminalAction(c, () =>
    bindPosDevice({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    }),
  );
  if (result instanceof Response) return result;

  appendSetCookieHeaders(c, result.setCookieHeaders);
  return c.json(result.device, 201);
}

export async function getPosDeviceController(c: Context<AppBindings>) {
  const deviceId = requirePathParam(c, "deviceId");
  if (deviceId instanceof Response) return deviceId;

  const device = await runTerminalAction(c, () =>
    getPosDevice({ authContext: c.get("authContext"), deviceId }),
  );
  return device instanceof Response ? device : c.json(device);
}

export async function updatePosDeviceController(c: Context<AppBindings>) {
  const deviceId = requirePathParam(c, "deviceId");
  if (deviceId instanceof Response) return deviceId;
  const data = updatePosDeviceBodySchema.parse(await c.req.json());

  const device = await runTerminalAction(c, () =>
    updatePosDevice({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      deviceId,
      data,
    }),
  );
  return device instanceof Response ? device : c.json(device);
}

export async function rotatePosDeviceCredentialController(
  c: Context<AppBindings>,
) {
  const deviceId = requirePathParam(c, "deviceId");
  if (deviceId instanceof Response) return deviceId;
  const data = rotatePosDeviceCredentialBodySchema.parse(await c.req.json());

  const result = await runTerminalAction(c, () =>
    rotatePosDeviceCredential({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      deviceId,
      data,
    }),
  );
  if (result instanceof Response) return result;

  appendSetCookieHeaders(c, result.setCookieHeaders);
  return c.json(result.device);
}

export async function setTerminalLockController(c: Context<AppBindings>) {
  const deviceId = requirePathParam(c, "deviceId");
  if (deviceId instanceof Response) return deviceId;
  const data = setTerminalLockBodySchema.parse(await c.req.json());

  const state = await runTerminalAction(c, () =>
    setTerminalLock({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      deviceId,
      data,
    }),
  );
  return state instanceof Response ? state : c.json(state);
}

export async function getTerminalStateController(c: Context<AppBindings>) {
  const deviceId = requirePathParam(c, "deviceId");
  if (deviceId instanceof Response) return deviceId;

  const state = await runTerminalAction(c, () =>
    getTerminalState({ authContext: c.get("authContext"), deviceId }),
  );
  return state instanceof Response ? state : c.json(state);
}
