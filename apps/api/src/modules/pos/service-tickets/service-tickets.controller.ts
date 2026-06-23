import type { Context } from "hono";

import type { AppBindings } from "../../../http/types.js";
import { ServiceTicketError } from "./service-tickets.errors.js";
import {
  changePosServiceTicketItemStatus,
  changePosServiceTicketStatus,
  createPosServiceTicket,
  createPosServiceTicketItem,
  deletePosServiceTicket,
  deletePosServiceTicketItem,
  getPosServiceTicketDetail,
  getPosServiceTicketOverview,
  getPosServiceTicketRelatedOrders,
  listPosServiceTickets,
  updatePosServiceTicket,
  updatePosServiceTicketItem,
} from "./service-tickets.service.js";
import { getRequestMeta } from "../request-meta.helper.js";
import {
  changeServiceTicketItemStatusBodySchema,
  changeServiceTicketStatusBodySchema,
  createServiceTicketBodySchema,
  createServiceTicketItemBodySchema,
  serviceTicketItemParamsSchema,
  serviceTicketListQuerySchema,
  serviceTicketOverviewQuerySchema,
  serviceTicketParamsSchema,
  updateServiceTicketBodySchema,
  updateServiceTicketItemBodySchema,
} from "./service-tickets.validation.js";

function createErrorResponse(c: Context<AppBindings>, error: ServiceTicketError) {
  return c.json(
    {
      message: error.message,
      code: error.code,
      requestId: c.get("requestId"),
    },
    error.status,
  );
}

// ---------------------------------------------------------------------------
// Ticket-level
// ---------------------------------------------------------------------------

export async function listServiceTicketsController(c: Context<AppBindings>) {
  const query = serviceTicketListQuerySchema.parse(c.req.query());
  const result = await listPosServiceTickets(c.get("authContext"), query);
  // result is { data, total }; flatten so the wire shape is { data, total }.
  return c.json(result);
}

export async function getServiceTicketOverviewController(
  c: Context<AppBindings>,
) {
  const query = serviceTicketOverviewQuerySchema.parse(c.req.query());
  const result = await getPosServiceTicketOverview(c.get("authContext"), query);
  return c.json(result);
}

export async function getServiceTicketController(c: Context<AppBindings>) {
  const params = serviceTicketParamsSchema.parse(c.req.param());

  try {
    const ticket = await getPosServiceTicketDetail(
      c.get("authContext"),
      params.ticketId,
    );
    return c.json(ticket);
  } catch (error) {
    if (error instanceof ServiceTicketError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function createServiceTicketController(c: Context<AppBindings>) {
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createServiceTicketBodySchema.parse(rawBody);

  try {
    const ticket = await createPosServiceTicket(
      c.get("authContext"),
      data,
      getRequestMeta(c),
    );
    return c.json(ticket, 201);
  } catch (error) {
    if (error instanceof ServiceTicketError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function updateServiceTicketController(c: Context<AppBindings>) {
  const params = serviceTicketParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateServiceTicketBodySchema.parse(rawBody);

  try {
    const ticket = await updatePosServiceTicket(
      c.get("authContext"),
      params.ticketId,
      data,
      getRequestMeta(c),
    );
    return c.json(ticket);
  } catch (error) {
    if (error instanceof ServiceTicketError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function changeServiceTicketStatusController(
  c: Context<AppBindings>,
) {
  const params = serviceTicketParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = changeServiceTicketStatusBodySchema.parse(rawBody);

  try {
    const ticket = await changePosServiceTicketStatus(
      c.get("authContext"),
      params.ticketId,
      data,
      getRequestMeta(c),
    );
    return c.json(ticket);
  } catch (error) {
    if (error instanceof ServiceTicketError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function deleteServiceTicketController(c: Context<AppBindings>) {
  const params = serviceTicketParamsSchema.parse(c.req.param());

  try {
    await deletePosServiceTicket(
      c.get("authContext"),
      params.ticketId,
      getRequestMeta(c),
    );
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof ServiceTicketError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function getServiceTicketRelatedOrdersController(
  c: Context<AppBindings>,
) {
  const params = serviceTicketParamsSchema.parse(c.req.param());

  try {
    const orders = await getPosServiceTicketRelatedOrders(
      c.get("authContext"),
      params.ticketId,
    );
    return c.json({ data: orders });
  } catch (error) {
    if (error instanceof ServiceTicketError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Ticket items
// ---------------------------------------------------------------------------

export async function createServiceTicketItemController(
  c: Context<AppBindings>,
) {
  const params = serviceTicketParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = createServiceTicketItemBodySchema.parse(rawBody);

  try {
    const item = await createPosServiceTicketItem(
      c.get("authContext"),
      { ticketId: params.ticketId, data },
      getRequestMeta(c),
    );
    return c.json(item, 201);
  } catch (error) {
    if (error instanceof ServiceTicketError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function updateServiceTicketItemController(
  c: Context<AppBindings>,
) {
  const params = serviceTicketItemParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = updateServiceTicketItemBodySchema.parse(rawBody);

  try {
    const item = await updatePosServiceTicketItem(
      c.get("authContext"),
      { ticketId: params.ticketId, itemId: params.itemId, data },
      getRequestMeta(c),
    );
    return c.json(item);
  } catch (error) {
    if (error instanceof ServiceTicketError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function changeServiceTicketItemStatusController(
  c: Context<AppBindings>,
) {
  const params = serviceTicketItemParamsSchema.parse(c.req.param());
  const rawBody = await c.req.json().catch(() => ({}));
  const data = changeServiceTicketItemStatusBodySchema.parse(rawBody);

  try {
    const item = await changePosServiceTicketItemStatus(
      c.get("authContext"),
      { ticketId: params.ticketId, itemId: params.itemId, data },
      getRequestMeta(c),
    );
    return c.json(item);
  } catch (error) {
    if (error instanceof ServiceTicketError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}

export async function deleteServiceTicketItemController(
  c: Context<AppBindings>,
) {
  const params = serviceTicketItemParamsSchema.parse(c.req.param());

  try {
    await deletePosServiceTicketItem(
      c.get("authContext"),
      { ticketId: params.ticketId, itemId: params.itemId },
      getRequestMeta(c),
    );
    return c.body(null, 204);
  } catch (error) {
    if (error instanceof ServiceTicketError) {
      return createErrorResponse(c, error);
    }
    throw error;
  }
}
