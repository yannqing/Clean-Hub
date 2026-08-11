import { and, eq, isNull } from "drizzle-orm";

import { customers, getDb, type Database } from "@cleanhub/db";

import type { AuthContext, AuthRequestMeta } from "../../auth/auth.types.js";
import { requireFeatureEnabled } from "../../auth/permission.helper.js";
import { writeAuditLog } from "../../audit/audit.helper.js";
import { findBranchById } from "../../tenant/branches/branches.repository.js";
import {
  authorizePosSensitiveOperation,
  createPosAuditMetadata,
  requirePosBranchAccess,
  requirePosTenantId,
  resolvePosBranchScope,
} from "../access-control.helper.js";
import { findPosCatalogServiceById } from "../catalog/catalog.repository.js";
import { ServiceTicketError } from "./service-tickets.errors.js";
import {
  areLinkedOrdersSettled,
  changeServiceTicketStatusRecord,
  countServiceTickets,
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

type ResolvedTicketItemPricing = {
  serviceId: string;
  itemName: string;
  pricingUnit: "per_item" | "per_kg";
  standardUnitAmount: string;
  chargedUnitAmount: string;
  quantity: number;
  weight: string | null;
  bagCount: number | null;
  overrideReason?: string;
};

/**
 * Maps a service ticket's workflow to the tenant feature flag that must be
 * enabled before the ticket can be created or mutated. Retail sales and
 * delivery tasks deliberately do not have service-ticket workflows.
 */
const BUSINESS_LINE_FEATURES: Record<ServiceTicketType, "laundry" | "car_wash"> = {
  laundry: "laundry",
  car_wash: "car_wash",
};

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

function moneyEquals(left: string, right: string): boolean {
  return Number(left).toFixed(2) === Number(right).toFixed(2);
}

async function resolveTicketItemPricing(
  db: Database,
  input: {
    authContext: AuthContext;
    tenantId: string;
    ticket: {
      branchId: string;
      currency: string;
      ticketType: ServiceTicketType;
    };
    data: CreateServiceTicketItemRequest | UpdateServiceTicketItemRequest;
    existing?: ServiceTicketItem;
  },
): Promise<ResolvedTicketItemPricing> {
  const serviceId = input.data.serviceId ?? input.existing?.serviceId;
  if (!serviceId) {
    throw new ServiceTicketError(
      "VALIDATION_ERROR",
      "A catalog service is required for every ticket item.",
      422,
    );
  }

  const service = await findPosCatalogServiceById(db, {
    tenantId: input.tenantId,
    branchId: input.ticket.branchId,
    serviceId,
  });
  if (!service) {
    throw new ServiceTicketError(
      "VALIDATION_ERROR",
      "The selected catalog service is not active or has no active price.",
      422,
    );
  }
  if (service.businessLine !== input.ticket.ticketType) {
    throw new ServiceTicketError(
      "VALIDATION_ERROR",
      "The selected service does not belong to this ticket business line.",
      422,
    );
  }
  if (service.currency !== input.ticket.currency) {
    throw new ServiceTicketError(
      "VALIDATION_ERROR",
      "The selected service price currency does not match the ticket currency.",
      422,
    );
  }

  const serviceChanged = !input.existing || serviceId !== input.existing.serviceId;
  const standardUnitAmount =
    serviceChanged || !input.existing
      ? service.amount
      : input.existing.standardUnitAmount;
  const chargedUnitAmount =
    input.data.chargedUnitAmount ??
    (serviceChanged || !input.existing
      ? standardUnitAmount
      : input.existing.chargedUnitAmount);
  const priceWasSubmitted =
    input.data.chargedUnitAmount !== undefined || serviceChanged;
  const overrideReason =
    priceWasSubmitted && !moneyEquals(chargedUnitAmount, standardUnitAmount)
      ? authorizePosSensitiveOperation(
          input.authContext,
          "price_override",
          input.data.overrideReason,
        )
      : undefined;

  if (service.pricingUnit === "per_kg") {
    const weight = input.data.weight ?? input.existing?.weight;
    if (!weight || Number(weight) <= 0) {
      throw new ServiceTicketError(
        "VALIDATION_ERROR",
        "Weight is required for a per-kilogram service.",
        422,
      );
    }
    return {
      serviceId,
      itemName: service.name,
      pricingUnit: service.pricingUnit,
      standardUnitAmount,
      chargedUnitAmount,
      quantity: 1,
      weight,
      bagCount: input.data.bagCount ?? input.existing?.bagCount ?? 1,
      overrideReason,
    };
  }

  return {
    serviceId,
    itemName: service.name,
    pricingUnit: service.pricingUnit,
    standardUnitAmount,
    chargedUnitAmount,
    quantity: input.data.quantity ?? input.existing?.quantity ?? 1,
    weight: null,
    bagCount: null,
    overrideReason,
  };
}

// ---------------------------------------------------------------------------
// List / detail / overview
// ---------------------------------------------------------------------------

export async function listPosServiceTickets(
  authContext: AuthContext,
  query: ServiceTicketListQuery,
  db: Database = getDb(),
): Promise<{ data: ServiceTicketSummary[]; total: number }> {
  const tenantId = requirePosTenantId(authContext);

  if (query.branchId) {
    requirePosBranchAccess(authContext, query.branchId);
  }

  await requireTicketFeature(authContext, query.ticketType, db);

  const listInput = {
    tenantId,
    allowedBranchIds: resolvePosBranchScope(authContext),
    status: query.status ? (Array.isArray(query.status) ? query.status : [query.status]) : undefined,
    priority: query.priority,
    ticketType: query.ticketType,
    sourceChannel: query.sourceChannel,
    customerId: query.customerId,
    branchId: query.branchId,
    assistantId: query.assistantId,
    q: query.q,
    createdBefore: query.createdBefore,
    createdAfter: query.createdAfter,
    expectedPickupBefore: query.expectedPickupBefore,
    expectedPickupAfter: query.expectedPickupAfter,
    limit: query.limit ?? 50,
    offset: query.offset ?? 0,
  };

  // Run row fetch + total count in parallel; both share the same filter set.
  const [data, total] = await Promise.all([
    findServiceTickets(db, listInput),
    countServiceTickets(db, listInput),
  ]);

  return { data, total };
}

export async function getPosServiceTicketDetail(
  authContext: AuthContext,
  ticketId: string,
  db: Database = getDb(),
): Promise<ServiceTicketDetail> {
  const tenantId = requirePosTenantId(authContext);

  const detail = await findServiceTicketDetail(db, { tenantId, ticketId });

  if (!detail) {
    throw new ServiceTicketError(
      "SERVICE_TICKET_NOT_FOUND",
      "Service ticket was not found.",
      404,
    );
  }

  await requireTicketFeature(authContext, detail.ticketType, db);
  requirePosBranchAccess(authContext, detail.branchId);

  return detail;
}

export async function getPosServiceTicketOverview(
  authContext: AuthContext,
  query: { branchId?: string },
  db: Database = getDb(),
): Promise<ServiceTicketOverview> {
  const tenantId = requirePosTenantId(authContext);

  if (query.branchId) {
    requirePosBranchAccess(authContext, query.branchId);
  }

  return findServiceTicketOverview(db, {
    tenantId,
    allowedBranchIds: resolvePosBranchScope(authContext),
    branchId: query.branchId,
    timeZone: authContext.timezone ?? "UTC",
  });
}

export async function getPosServiceTicketRelatedOrders(
  authContext: AuthContext,
  ticketId: string,
  db: Database = getDb(),
): Promise<RelatedOrderSummary[]> {
  const tenantId = requirePosTenantId(authContext);

  const ticket = await findServiceTicketRaw(db, { tenantId, ticketId });
  if (!ticket) {
    throw new ServiceTicketError(
      "SERVICE_TICKET_NOT_FOUND",
      "Service ticket was not found.",
      404,
    );
  }
  requirePosBranchAccess(authContext, ticket.branchId);

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
  const tenantId = requirePosTenantId(authContext);

  requirePosBranchAccess(authContext, data.branchId);
  await requireTicketFeature(authContext, data.ticketType, db);
  await requireCustomerActive(db, { tenantId, customerId: data.customerId });
  const branch = await findBranchById(db, {
    tenantId,
    branchId: data.branchId,
  });

  if (!branch) {
    throw new ServiceTicketError(
      "BRANCH_NOT_ALLOWED",
      "Branch was not found.",
      404,
    );
  }

  return db.transaction(async (tx) => {
    const summary = await createServiceTicketRecord(tx, {
      ...data,
      currency: branch.defaultCurrency,
      assistantId: authContext.userId,
      tenantId,
      actorUserId: authContext.userId,
      timeZone: authContext.timezone ?? "UTC",
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
      metadata: createPosAuditMetadata(authContext),
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
  const tenantId = requirePosTenantId(authContext);

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

    requirePosBranchAccess(authContext, before.branchId);
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
      metadata: createPosAuditMetadata(authContext),
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
  const tenantId = requirePosTenantId(authContext);
  const cancellationReason =
    data.to === "cancelled"
      ? authorizePosSensitiveOperation(authContext, "cancel", data.reason)
      : undefined;

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

    requirePosBranchAccess(authContext, before.branchId);
    await requireTicketFeature(authContext, before.ticketType, tx);

    const from = before.ticketStatus;
    const to = data.to;

    if (from === to) {
      const detail = await findServiceTicketDetail(tx, { tenantId, ticketId });
      if (!detail) {
        throw new Error("Service ticket could not be loaded for status replay.");
      }
      return detail;
    }

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
      reason: cancellationReason,
      metadata:
        data.note || cancellationReason
          ? createPosAuditMetadata(authContext, { note: data.note })
          : createPosAuditMetadata(authContext),
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return detail;
  });
}

export async function deletePosServiceTicket(
  authContext: AuthContext,
  ticketId: string,
  reason: string,
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<void> {
  const normalizedReason = authorizePosSensitiveOperation(
    authContext,
    "delete",
    reason,
  );
  const tenantId = requirePosTenantId(authContext);

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

    requirePosBranchAccess(authContext, before.branchId);

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
      reason: normalizedReason,
      metadata: createPosAuditMetadata(authContext),
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
  const tenantId = requirePosTenantId(authContext);
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

    requirePosBranchAccess(authContext, before.branchId);
    await requireTicketFeature(authContext, before.ticketType, tx);

    const pricing = await resolveTicketItemPricing(tx, {
      authContext,
      tenantId,
      ticket: before,
      data,
    });
    const {
      bagCount: _bagCount,
      chargedUnitAmount: _chargedUnitAmount,
      overrideReason: _overrideReason,
      quantity: _quantity,
      serviceId: _serviceId,
      weight: _weight,
      ...operationalData
    } = data;

    const item = await createServiceTicketItemRecord(tx, {
      ...operationalData,
      ...pricing,
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
      after: {
        itemId: item.id,
        labelCode: item.labelCode,
        serviceId: item.serviceId,
        pricingUnit: item.pricingUnit,
        standardUnitAmount: item.standardUnitAmount,
        chargedUnitAmount: item.chargedUnitAmount,
        quantity: item.quantity,
        weight: item.weight,
        bagCount: item.bagCount,
      },
      reason: pricing.overrideReason,
      metadata: createPosAuditMetadata(authContext),
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
  const tenantId = requirePosTenantId(authContext);
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

    requirePosBranchAccess(authContext, before.branchId);

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

    const pricing = await resolveTicketItemPricing(tx, {
      authContext,
      tenantId,
      ticket: before,
      data,
      existing,
    });
    const {
      bagCount: _bagCount,
      chargedUnitAmount: _chargedUnitAmount,
      overrideReason: _overrideReason,
      quantity: _quantity,
      serviceId: _serviceId,
      weight: _weight,
      ...operationalData
    } = data;

    const item = await updateServiceTicketItemRecord(tx, {
      ...operationalData,
      ...pricing,
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
      before: {
        serviceId: existing.serviceId,
        pricingUnit: existing.pricingUnit,
        standardUnitAmount: existing.standardUnitAmount,
        chargedUnitAmount: existing.chargedUnitAmount,
        quantity: existing.quantity,
        weight: existing.weight,
        bagCount: existing.bagCount,
      },
      after: {
        serviceId: item.serviceId,
        pricingUnit: item.pricingUnit,
        standardUnitAmount: item.standardUnitAmount,
        chargedUnitAmount: item.chargedUnitAmount,
        quantity: item.quantity,
        weight: item.weight,
        bagCount: item.bagCount,
      },
      reason: pricing.overrideReason,
      metadata: createPosAuditMetadata(authContext, { itemId }),
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
  const tenantId = requirePosTenantId(authContext);
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

    requirePosBranchAccess(authContext, before.branchId);

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
      metadata: createPosAuditMetadata(authContext, { itemId }),
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });

    return item;
  });
}

export async function deletePosServiceTicketItem(
  authContext: AuthContext,
  input: ServiceTicketItemListInput & { itemId: string; reason: string },
  requestMeta: AuthRequestMeta = {},
  db: Database = getDb(),
): Promise<void> {
  const normalizedReason = authorizePosSensitiveOperation(
    authContext,
    "delete",
    input.reason,
  );
  const tenantId = requirePosTenantId(authContext);
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

    requirePosBranchAccess(authContext, before.branchId);

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
      before: existing,
      after: { deleted: true },
      reason: normalizedReason,
      metadata: createPosAuditMetadata(authContext, { itemId }),
      ipAddress: requestMeta.ipAddress,
      userAgent: requestMeta.userAgent,
    });
  });
}
