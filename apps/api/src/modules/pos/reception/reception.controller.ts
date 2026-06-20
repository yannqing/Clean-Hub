import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";
import { getRequestMeta } from "../request-meta.helper.js";
import {
  createPosReceptionEvent,
  getPosReceptionSummary,
  listPosReceptionEvents,
} from "./reception.service.js";
import type {
  CreatePosReceptionEventRequest,
  PosReceptionEventListQuery,
} from "./reception.types.js";

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

export async function listPosReceptionEventsController(c: Context<AppBindings>) {
  const query = c.req.query() as PosReceptionEventListQuery;
  const result = await listPosReceptionEvents({
    authContext: c.get("authContext"),
    query,
  });
  return c.json({ data: result });
}

export async function createPosReceptionEventController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = rawBody as CreatePosReceptionEventRequest;

  try {
    const event = await createPosReceptionEvent({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    });
    return c.json(event, 201);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
      return notImplementedResponse(c, error);
    }
    throw error;
  }
}

export async function getPosReceptionSummaryController(c: Context<AppBindings>) {
  const date = c.req.query("date");

  try {
    const summary = await getPosReceptionSummary({
      authContext: c.get("authContext"),
      date,
    });
    return c.json(summary);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
      return notImplementedResponse(c, error);
    }
    throw error;
  }
}
