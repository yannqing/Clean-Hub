import { and, eq, isNull } from "drizzle-orm";

import { customers, getDb, type Database } from "@cleanhub/db";

import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import { assertPosContext, requireFeatureEnabled, requirePosBranchId } from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { ServiceTicketError } from "./service-tickets.errors.js";
import {
  areLinkedOrdersSettled,
  changeServiceTicketStatusRecord,
  createServiceTicketRecord,
  findRelatedOrders,
  findServiceTicketById,
  findServiceTicketAuditSnapshot,
  findServiceTicketDetail,
  findServiceTicketOverview,
  findServiceTicketRaw,
  findServiceTickets,
  softDeleteServiceTicketRecord,
  updateServiceTicketRecord,
} from "./service-tickets.repository.js";
import {
  changeServiceTicketItemStatusRecord,
  createServiceTicketItemRecord,
  findTicketItemById,
  softDeleteServiceTicketItemRecord,
  updateServiceTicketItemRecord,
} from "./service-ticket-items.repository.js";
import {
  isAllowedItemTransition,
  isAllowedTicketTransition,
  requiresSettlementCheck,
} from "./service-tickets.state-machine.js";
import type {
  ChangeServiceTicketItemStatusRequest,
  ChangeServiceTicketStatusRequest,
  CreateServiceTicketItemRequest,
  CreateServiceTicketRequest,
  RelatedOrderSummary,
  ServiceTicketDetail,
  ServiceTicketItem,
  ServiceTicketItemListInput,
  ServiceTicketListQuery,
  ServiceTicketOverview,
  ServiceTicketSummary,
  ServiceTicketType,
  UpdateServiceTicketItemRequest,
  UpdateServiceTicketRequest,
} from "./service-tickets.types.js";

/**
 * Maps a ticket's business line to the tenant feature flag that must be
 * enabled before the ticket can be created or mutated. `retail` and `delivery`
 * map to their dedicated flags; the feature-flag type lives in the auth
 * permission helper.
 */
const BUSINESS_LINE_FEATURES: Record<ServiceTicketType, "laundry" | "car_wash" | "retail" | "delivery"> = {
  laundry: "laundry",
  car_wash: "car_wash",
  retail: "retail",
  delivery: "delivery",
};

function requirePosContext(authContext: AuthContext): string {
  assertPosContext(authContext);
  return authContext.tenantId!;
}

/**
 * Branches the caller may list. Returns `undefined` for "no branch filter"
 * (owner/manager with no explicit assignment → see all tenant branches),
 * or an explicit branch-id list (cashier scope). An empty array means the
 * caller is a non-owner with no branch assignment → nothing is visible.
 */
function resolveListBranchScope(
  authContext: AuthContext,
): string[] | undefined {
  if (authContext.role === "owner" || authContext.role === "manager") {
    // Owner/manager: no enforcement unless the token happens to carry an
    // explicit branch list (treat empty as "all").
    return authContext.branchIds.length > 0
      ? authContext.branchIds
      : undefined;
  }
  return authContext.branchIds;
}

async function requireTicketFeature(
  authContext: AuthContext,
  ticketType: ServiceTicketType | undefined,
  db: Database,
): Promise<void> {
  if (!ticketType) {
    return;
  }
  const feature = BUSINESS_LINE_FEATURES[ticketType];
  await requireFeatureEnabled(authContext, feature, db);
}

async function requireCustomerActive(
  db: Database,
  input: { tenantId: string; customerId: string },
): Promise<void> {
  const rows = await db
    .select({ id: customers.id, status: customers.status })
    .from(customers)
    .where(
      and(
        eq(customers.id, input.customerId),
        eq(customers.tenantId, input.tenantId),
        isNull(customers.deletedAt),
      ),
    )
    .limit(1);

  const customer = rows[0];
  if (!customer) {
    throw new ServiceTicketError(
      "CUSTOMER_NOT_FOUND",
      "Customer profile was not found.",
      404,
    );
  }
  if (customer.status !== "active") {
    throw new ServiceTicketError(
      "CUSTOMER_DISABLED",
      "Disabled customers cannot be used to create new tickets.",
      422,
    );
  }
}

// ---------------------------------------------------------------------------
// List / detail / overview
// ---------------------------------------------------------------------------

export async function listPosServiceTickets(
  authContext: AuthContext,
  query: ServiceTicketListQuery,
  db: Database = getDb(),
): Promise<ServiceTicketSummary[]> {
  const tenantId = requirePosContext(authContext);

  await requireTicketFeature(authContext, query.ticketType, db);

  return findServiceTickets(db, {
    tenantId,
    allowedBranchIds: resolveListBranchScope(authContext),
    status: query.status ? (Array.isArray(query.status) ? query.status : [query.status]) : undefined,
    priority: query.priority,
    ticketType: query.ticketType,
    sourceChannel: query.sourceChannel,
    customerId: query.customerId,
    branchId: query.branchId,
    assistantId: query.assistantId,
    q: query.q,
    expectedPickupBefore: query.expectedPickupBefore,
    expectedPickupAfter: query.expectedPickupAfter,
    limit: query.limit ?? 50,
    offset: query.offset ?? 0,
  });
}

export async function getPosServiceTicketDetail(
  authContext: AuthContext,
  ticketId: string,
  db: Database = getDb(),
): Promise<ServiceTicketDetail> {
  const tenantId = requirePosContext(authContext);

  const detail = await findServiceTicketDetail(db, { tenantId, ticketId });

  if (!detail) {
    throw new ServiceTicketError(
      "SERVICE_TICKET_NOT_FOUND",
      "Service ticket was not found.",
      404,
    );
  }

  await requireTicketFeature(authContext, detail.ticketType, db);
  await requirePosBranchId(authContext, detail.branchId, db);

  return detail;
}

export async function getPosServiceTicketOverview(
  authContext: AuthContext,
  query: { branchId?: string },
  db: Database = getDb(),
): Promise<ServiceTicketOverview> {
  const tenantId = requirePosContext(authContext);

  if (query.branchId) {
    await requirePosBranchId(authContext, query.branchId, db);
  }

  return findServiceTicketOverview(db, {
    tenantId,
    allowedBranchIds: resolveListBranchScope(authContext),
    branchId: query.branchId,
  });
}

export async function getPosServiceTicketRelatedOrders(
  authContext: AuthContext,
  ticketId: string,
  db: Database = getDb(),
): Promise<RelatedOrderSummary[]> {
  const tenantId = requirePosContext(authContext);

  const ticket = await findServiceTicketRaw(db, { tenantId, ticketId });
  if (!ticket) {
    throw new ServiceTicketError(
      "SERVICE_TICKET_NOT_FOUND",
      "Service ticket was not found.",
      404,
    );
  }
  await requirePosBranchId(authContext, ticket.branchId, db);

  return findRelatedOrders(db, { tenantId, ticketId });
}

// ---------------------------------------------------------------------------
// Create / update / delete
// ---------------------------------------------------------------------------

export async function createPosServiceTicket(
  authContext: AuthContext,
  data: CreateServiceTicketRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<ServiceTicketDetail> {
  const tenantId = requirePosContext(authContext);

  await requirePosBranchId(authContext, data.branchId, db);
  await requireTicketFeature(authContext, data.ticketType, db);
  await requireCustomerActive(db, { tenantId, customerId: data.customerId });

  return db.transaction(async (tx) => {
    const summary = await createServiceTicketRecord(tx, {
      ...data,
      tenantId,
      actorUserId: authContext.userId,
    });

    const detail = await findServiceTicketDetail(tx, {
      tenantId,
      ticketId: summary.id,
    });
    if (!detail) {
      throw new Error("Created service ticket could not be loaded.");
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      branchId: summary.branchId,
      eventCategory: "pos_service_ticket",
      eventType: "pos.service_ticket.created",
      entityType: "service_ticket",
      entityId: summary.id,
      after: summary,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return detail;
  });
}

export async function updatePosServiceTicket(
  authContext: AuthContext,
  ticketId: string,
  data: UpdateServiceTicketRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<ServiceTicketDetail> {
  const tenantId = requirePosContext(authContext);

  return db.transaction(async (tx) => {
    const before = await findServiceTicketAuditSnapshot(tx, {
      tenantId,
      ticketId,
    });

    if (!before) {
      throw new ServiceTicketError(
        "SERVICE_TICKET_NOT_FOUND",
        "Service ticket was not found.",
        404,
      );
    }

    await requirePosBranchId(authContext, before.branchId, tx);
    await requireTicketFeature(
      authContext,
      data.ticketType ?? before.ticketType,
      tx,
    );

    const summary = await updateServiceTicketRecord(tx, {
      ...data,
      tenantId,
      ticketId,
      actorUserId: authContext.userId,
    });

    if (!summary) {
      throw new ServiceTicketError(
        "SERVICE_TICKET_NOT_FOUND",
        "Service ticket was not found.",
        404,
      );
    }

    const detail = await findServiceTicketDetail(tx, {
      tenantId,
      ticketId,
    });
    if (!detail) {
      throw new Error("Updated service ticket could not be loaded.");
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      branchId: summary.branchId,
      eventCategory: "pos_service_ticket",
      eventType: "pos.service_ticket.updated",
      entityType: "service_ticket",
      entityId: ticketId,
      before,
      after: summary,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return detail;
  });
}

export async function changePosServiceTicketStatus(
  authContext: AuthContext,
  ticketId: string,
  data: ChangeServiceTicketStatusRequest,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<ServiceTicketDetail> {
  const tenantId = requirePosContext(authContext);

  return db.transaction(async (tx) => {
    const before = await findServiceTicketAuditSnapshot(tx, {
      tenantId,
      ticketId,
    });

    if (!before) {
      throw new ServiceTicketError(
        "SERVICE_TICKET_NOT_FOUND",
        "Service ticket was not found.",
        404,
      );
    }

    await requirePosBranchId(authContext, before.branchId, tx);
    await requireTicketFeature(authContext, before.ticketType, tx);

    const from = before.ticketStatus;
    const to = data.to;

    if (!isAllowedTicketTransition(from, to)) {
      throw new ServiceTicketError(
        "INVALID_STATUS_TRANSITION",
        `Cannot transition ticket from "${from}" to "${to}".`,
        422,
      );
    }

    if (requiresSettlementCheck(from, to)) {
      const settled = await areLinkedOrdersSettled(tx, {
        tenantId,
        ticketId,
      });
      if (!settled) {
        throw new ServiceTicketError(
          "PICKUP_REQUIRES_SETTLEMENT",
          "Ticket cannot be picked up until all linked orders are paid.",
          422,
        );
      }
    }

    const result = await changeServiceTicketStatusRecord(tx, {
      tenantId,
      ticketId,
      actorUserId: authContext.userId,
      version: data.version,
      to,
    });

    if (!result.updated) {
      if (!result.exists) {
        throw new ServiceTicketError(
          "SERVICE_TICKET_NOT_FOUND",
          "Service ticket was not found.",
          404,
        );
      }
      throw new ServiceTicketError(
        "VERSION_CONFLICT",
        "Service ticket has been modified. Refresh and try again.",
        409,
      );
    }

    const summary = await findServiceTicketById(tx, { tenantId, ticketId });
    const detail = await findServiceTicketDetail(tx, { tenantId, ticketId });
    if (!detail || !summary) {
      throw new Error("Updated service ticket could not be loaded.");
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      branchId: before.branchId,
      eventCategory: "pos_service_ticket",
      eventType: "pos.service_ticket.status_changed",
      entityType: "service_ticket",
      entityId: ticketId,
      before: { ticketStatus: from },
      after: { ticketStatus: to },
      metadata: data.note ? { note: data.note } : undefined,
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return detail;
  });
}

export async function deletePosServiceTicket(
  authContext: AuthContext,
  ticketId: string,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<void> {
  const tenantId = requirePosContext(authContext);

  await db.transaction(async (tx) => {
    const before = await findServiceTicketAuditSnapshot(tx, {
      tenantId,
      ticketId,
    });

    if (!before) {
      throw new ServiceTicketError(
        "SERVICE_TICKET_NOT_FOUND",
        "Service ticket was not found.",
        404,
      );
    }

    await requirePosBranchId(authContext, before.branchId, tx);

    const deleted = await softDeleteServiceTicketRecord(tx, {
      tenantId,
      ticketId,
      actorUserId: authContext.userId,
    });

    if (!deleted) {
      throw new ServiceTicketError(
        "SERVICE_TICKET_NOT_FOUND",
        "Service ticket was not found.",
        404,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      branchId: before.branchId,
      eventCategory: "pos_service_ticket",
      eventType: "pos.service_ticket.deleted",
      entityType: "service_ticket",
      entityId: ticketId,
      before,
      after: { deleted: true },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
  });
}

// ---------------------------------------------------------------------------
// Ticket items
// ---------------------------------------------------------------------------

export async function createPosServiceTicketItem(
  authContext: AuthContext,
  input: ServiceTicketItemListInput & {
    data: CreateServiceTicketItemRequest;
  },
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<ServiceTicketItem> {
  const tenantId = requirePosContext(authContext);
  const { ticketId, data } = input;

  return db.transaction(async (tx) => {
    const before = await findServiceTicketAuditSnapshot(tx, {
      tenantId,
      ticketId,
    });
    if (!before) {
      throw new ServiceTicketError(
        "SERVICE_TICKET_NOT_FOUND",
        "Service ticket was not found.",
        404,
      );
    }

    await requirePosBranchId(authContext, before.branchId, tx);
    await requireTicketFeature(authContext, before.ticketType, tx);

    const item = await createServiceTicketItemRecord(tx, {
      ...data,
      tenantId,
      ticketId,
      actorUserId: authContext.userId,
    });

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      branchId: before.branchId,
      eventCategory: "pos_service_ticket",
      eventType: "pos.service_ticket.item_added",
      entityType: "service_ticket",
      entityId: ticketId,
      after: { itemId: item.id, labelCode: item.labelCode },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return item;
  });
}

export async function updatePosServiceTicketItem(
  authContext: AuthContext,
  input: ServiceTicketItemListInput & {
    itemId: string;
    data: UpdateServiceTicketItemRequest;
  },
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<ServiceTicketItem> {
  const tenantId = requirePosContext(authContext);
  const { ticketId, itemId, data } = input;

  return db.transaction(async (tx) => {
    const before = await findServiceTicketAuditSnapshot(tx, {
      tenantId,
      ticketId,
    });
    if (!before) {
      throw new ServiceTicketError(
        "SERVICE_TICKET_NOT_FOUND",
        "Service ticket was not found.",
        404,
      );
    }

    await requirePosBranchId(authContext, before.branchId, tx);

    const item = await updateServiceTicketItemRecord(tx, {
      ...data,
      tenantId,
      ticketId,
      itemId,
      actorUserId: authContext.userId,
    });

    if (!item) {
      throw new ServiceTicketError(
        "SERVICE_TICKET_ITEM_NOT_FOUND",
        "Service ticket item was not found.",
        404,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      branchId: before.branchId,
      eventCategory: "pos_service_ticket",
      eventType: "pos.service_ticket.item_updated",
      entityType: "service_ticket",
      entityId: ticketId,
      metadata: { itemId },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return item;
  });
}

export async function changePosServiceTicketItemStatus(
  authContext: AuthContext,
  input: ServiceTicketItemListInput & {
    itemId: string;
    data: ChangeServiceTicketItemStatusRequest;
  },
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<ServiceTicketItem> {
  const tenantId = requirePosContext(authContext);
  const { ticketId, itemId, data } = input;

  return db.transaction(async (tx) => {
    const before = await findServiceTicketAuditSnapshot(tx, {
      tenantId,
      ticketId,
    });
    if (!before) {
      throw new ServiceTicketError(
        "SERVICE_TICKET_NOT_FOUND",
        "Service ticket was not found.",
        404,
      );
    }

    await requirePosBranchId(authContext, before.branchId, tx);

    const existing = await findTicketItemById(tx, {
      tenantId,
      ticketId,
      itemId,
    });
    if (!existing) {
      throw new ServiceTicketError(
        "SERVICE_TICKET_ITEM_NOT_FOUND",
        "Service ticket item was not found.",
        404,
      );
    }

    if (!isAllowedItemTransition(existing.itemStatus, data.to)) {
      throw new ServiceTicketError(
        "INVALID_ITEM_STATUS_TRANSITION",
        `Cannot transition item from "${existing.itemStatus}" to "${data.to}".`,
        422,
      );
    }

    const result = await changeServiceTicketItemStatusRecord(tx, {
      tenantId,
      ticketId,
      itemId,
      actorUserId: authContext.userId,
      to: data.to,
    });
    if (!result.updated) {
      throw new ServiceTicketError(
        "SERVICE_TICKET_ITEM_NOT_FOUND",
        "Service ticket item was not found.",
        404,
      );
    }

    const item = await findTicketItemById(tx, {
      tenantId,
      ticketId,
      itemId,
    });
    if (!item) {
      throw new Error("Updated service ticket item could not be loaded.");
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      branchId: before.branchId,
      eventCategory: "pos_service_ticket",
      eventType: "pos.service_ticket.item_status_changed",
      entityType: "service_ticket",
      entityId: ticketId,
      before: { itemStatus: existing.itemStatus },
      after: { itemStatus: data.to },
      metadata: { itemId },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return item;
  });
}

export async function deletePosServiceTicketItem(
  authContext: AuthContext,
  input: ServiceTicketItemListInput & { itemId: string },
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<void> {
  const tenantId = requirePosContext(authContext);
  const { ticketId, itemId } = input;

  await db.transaction(async (tx) => {
    const before = await findServiceTicketAuditSnapshot(tx, {
      tenantId,
      ticketId,
    });
    if (!before) {
      throw new ServiceTicketError(
        "SERVICE_TICKET_NOT_FOUND",
        "Service ticket was not found.",
        404,
      );
    }

    await requirePosBranchId(authContext, before.branchId, tx);

    const deleted = await softDeleteServiceTicketItemRecord(tx, {
      tenantId,
      ticketId,
      itemId,
      actorUserId: authContext.userId,
    });

    if (!deleted) {
      throw new ServiceTicketError(
        "SERVICE_TICKET_ITEM_NOT_FOUND",
        "Service ticket item was not found.",
        404,
      );
    }

    await writeAuditLog(tx, {
      actorUserId: authContext.userId,
      tenantId,
      branchId: before.branchId,
      eventCategory: "pos_service_ticket",
      eventType: "pos.service_ticket.item_removed",
      entityType: "service_ticket",
      entityId: ticketId,
      metadata: { itemId },
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
  });
}
