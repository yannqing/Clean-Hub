import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { requirePathParam } from "../require-path-param.helper.js";
import {
  clockAction,
  createHandover,
  getPosStaff,
  listPosStaff,
} from "./staff.service.js";
import type {
  ClockRequest,
  CreateHandoverRequest,
  PosStaffListQuery,
} from "./staff.types.js";

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

export async function listPosStaffController(c: Context<AppBindings>) {
  const query = c.req.query() as PosStaffListQuery;
  const result = await listPosStaff({
    authContext: c.get("authContext"),
    query,
  });
  return c.json({ data: result });
}

export async function getPosStaffController(c: Context<AppBindings>) {
  const staffId = requirePathParam(c, "staffId");
  if (staffId instanceof Response) {
    return staffId;
  }
  const staff = await getPosStaff({
    authContext: c.get("authContext"),
    staffId,
  });
  return c.json(staff);
}

export async function clockActionController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = rawBody as ClockRequest;

  try {
    const shift = await clockAction({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    });
    return c.json(shift);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
      return notImplementedResponse(c, error);
    }
    throw error;
  }
}

export async function createHandoverController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = rawBody as CreateHandoverRequest;

  try {
    const handover = await createHandover({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    });
    return c.json(handover, 201);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
      return notImplementedResponse(c, error);
    }
    throw error;
  }
}
