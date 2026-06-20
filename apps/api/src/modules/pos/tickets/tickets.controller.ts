import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import {
  createPosTicket,
  getPosTicket,
  listPosTickets,
  updatePosTicketStatus,
} from "./tickets.service.js";
import { PosNotImplementedError } from "../not-implemented.errors.js";
import { getRequestMeta } from "../request-meta.helper.js";
import { requirePathParam } from "../require-path-param.helper.js";
import type {
  CreatePosTicketRequest,
  PosTicketListQuery,
  UpdatePosTicketStatusRequest,
} from "./tickets.types.js";

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

export async function listPosTicketsController(c: Context<AppBindings>) {
  const query = c.req.query() as PosTicketListQuery;
  const result = await listPosTickets({
    authContext: c.get("authContext"),
    query,
  });
  return c.json({ data: result });
}

export async function getPosTicketController(c: Context<AppBindings>) {
  const ticketId = requirePathParam(c, "ticketId");
  if (ticketId instanceof Response) {
    return ticketId;
  }
  const ticket = await getPosTicket({
    authContext: c.get("authContext"),
    ticketId,
  });
  return c.json(ticket);
}

export async function createPosTicketController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = rawBody as CreatePosTicketRequest;

  try {
    const ticket = await createPosTicket({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      data,
    });
    return c.json(ticket, 201);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
      return notImplementedResponse(c, error);
    }
    throw error;
  }
}

export async function updatePosTicketStatusController(c: Context<AppBindings>) {
  const ticketId = requirePathParam(c, "ticketId");
  if (ticketId instanceof Response) {
    return ticketId;
  }
  const rawBody = await c.req.json().catch(() => ({}));
  const data = rawBody as UpdatePosTicketStatusRequest;

  try {
    const ticket = await updatePosTicketStatus({
      authContext: c.get("authContext"),
      requestMeta: getRequestMeta(c),
      ticketId,
      data,
    });
    return c.json(ticket);
  } catch (error) {
    if (error instanceof PosNotImplementedError) {
      return notImplementedResponse(c, error);
    }
    throw error;
  }
}
