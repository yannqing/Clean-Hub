import { and, eq, isNull, sql } from "drizzle-orm";

import { serviceTickets, ticketItems, type Database } from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import { ServiceTicketError } from "./service-tickets.errors.js";
import {
  generateLabelCode,
  toTicketItem,
} from "./service-tickets.repository.js";
import type {
  CreateServiceTicketItemRequest,
  ServiceTicketItem,
  ServiceTicketItemStatus,
  UpdateServiceTicketItemRequest,
} from "./service-tickets.types.js";

function normalizeNullable(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function computeLineAmount(quantity: number, unitAmount: string): string {
  const unit = Number(unitAmount);
  if (!Number.isFinite(unit)) {
    throw new ServiceTicketError(
      "VALIDATION_ERROR",
      "unitAmount must be a decimal number.",
      422,
    );
  }
  return (quantity * unit).toFixed(2);
}

/**
 * Resolve and lock the parent ticket row (shared row lock within the caller's
 * transaction) so concurrent item inserts serialize for label-code generation.
 * Returns the raw ticket row or null when the ticket is missing / soft-deleted
 * / belongs to another tenant.
 */
async function lockTicketForItems(
  db: Database,
  input: { tenantId: string; ticketId: string },
) {
  const rows = await db
    .select()
    .from(serviceTickets)
    .where(
      and(
        eq(serviceTickets.id, input.ticketId),
        eq(serviceTickets.tenantId, input.tenantId),
        isNull(serviceTickets.deletedAt),
      ),
    )
    .for("update")
    .limit(1);

  return rows[0] ?? null;
}

export async function findTicketItemById(
  db: Database,
  input: { tenantId: string; ticketId: string; itemId: string },
): Promise<ServiceTicketItem | null> {
  const rows = await db
    .select()
    .from(ticketItems)
    .where(
      and(
        eq(ticketItems.id, input.itemId),
        eq(ticketItems.ticketId, input.ticketId),
        eq(ticketItems.tenantId, input.tenantId),
        isNull(ticketItems.deletedAt),
      ),
    )
    .limit(1);

  return rows[0] ? toTicketItem(rows[0]) : null;
}

export async function createServiceTicketItemRecord(
  db: Database,
  input: CreateServiceTicketItemRequest & {
    tenantId: string;
    ticketId: string;
    actorUserId: string;
  },
): Promise<ServiceTicketItem> {
  const ticket = await lockTicketForItems(db, input);
  if (!ticket) {
    throw new ServiceTicketError(
      "SERVICE_TICKET_NOT_FOUND",
      "Service ticket was not found.",
      404,
    );
  }

  const quantity = input.quantity ?? 1;
  const lineAmount = computeLineAmount(quantity, input.unitAmount);
  const itemId = createId();
  const labelCode = await generateLabelCode(db, {
    tenantId: input.tenantId,
    ticketId: input.ticketId,
    ticketNo: ticket.ticketNo,
  });

  await db.insert(ticketItems).values({
    id: itemId,
    ticketId: input.ticketId,
    tenantId: input.tenantId,
    branchId: ticket.branchId,
    serviceId: normalizeNullable(input.serviceId ?? null),
    itemType: input.itemType ?? null,
    itemName: input.itemName.trim(),
    itemCategory: normalizeNullable(input.itemCategory ?? null),
    itemStatus: "washing",
    itemColor: normalizeNullable(input.itemColor ?? null),
    itemBrand: normalizeNullable(input.itemBrand ?? null),
    itemMaterial: normalizeNullable(input.itemMaterial ?? null),
    quantity,
    unitAmount: input.unitAmount,
    lineAmount,
    defectNotes: normalizeNullable(input.defectNotes ?? null),
    specialRequest: normalizeNullable(input.specialRequest ?? null),
    remark: normalizeNullable(input.remark ?? null),
    labelCode,
    sortOrder: input.sortOrder ?? 0,
    createdBy: input.actorUserId,
    updatedBy: input.actorUserId,
  });

  const item = await findTicketItemById(db, {
    tenantId: input.tenantId,
    ticketId: input.ticketId,
    itemId,
  });

  if (!item) {
    throw new Error("Created ticket item could not be loaded.");
  }

  // Bump parent version so the ticket reflects the structural change.
  await db
    .update(serviceTickets)
    .set({
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${serviceTickets.version} + 1`,
    })
    .where(eq(serviceTickets.id, input.ticketId));

  return item;
}

export async function updateServiceTicketItemRecord(
  db: Database,
  input: UpdateServiceTicketItemRequest & {
    tenantId: string;
    ticketId: string;
    itemId: string;
    actorUserId: string;
  },
): Promise<ServiceTicketItem | null> {
  const existing = await findTicketItemById(db, input);
  if (!existing) {
    return null;
  }

  const quantity = input.quantity ?? existing.quantity;
  const unitAmount = input.unitAmount ?? existing.unitAmount;
  const lineAmount =
    input.quantity !== undefined || input.unitAmount !== undefined
      ? computeLineAmount(quantity, unitAmount)
      : existing.lineAmount;

  await db
    .update(ticketItems)
    .set({
      itemName: input.itemName?.trim() ?? existing.itemName,
      itemType: input.itemType ?? existing.itemType,
      itemCategory:
        input.itemCategory === undefined
          ? existing.itemCategory
          : normalizeNullable(input.itemCategory),
      itemColor:
        input.itemColor === undefined
          ? existing.itemColor
          : normalizeNullable(input.itemColor),
      itemBrand:
        input.itemBrand === undefined
          ? existing.itemBrand
          : normalizeNullable(input.itemBrand),
      itemMaterial:
        input.itemMaterial === undefined
          ? existing.itemMaterial
          : normalizeNullable(input.itemMaterial),
      quantity,
      unitAmount,
      lineAmount,
      serviceId:
        input.serviceId === undefined
          ? existing.serviceId
          : normalizeNullable(input.serviceId),
      defectNotes:
        input.defectNotes === undefined
          ? existing.defectNotes
          : input.defectNotes ?? null,
      specialRequest:
        input.specialRequest === undefined
          ? existing.specialRequest
          : input.specialRequest ?? null,
      remark:
        input.remark === undefined ? existing.remark : input.remark ?? null,
      sortOrder: input.sortOrder ?? existing.sortOrder,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${ticketItems.version} + 1`,
    })
    .where(
      and(
        eq(ticketItems.id, input.itemId),
        eq(ticketItems.ticketId, input.ticketId),
        eq(ticketItems.tenantId, input.tenantId),
        isNull(ticketItems.deletedAt),
      ),
    );

  return findTicketItemById(db, input);
}

export async function changeServiceTicketItemStatusRecord(
  db: Database,
  input: {
    tenantId: string;
    ticketId: string;
    itemId: string;
    actorUserId: string;
    to: ServiceTicketItemStatus;
  },
): Promise<{ updated: boolean; exists: boolean }> {
  const updatedRows = await db
    .update(ticketItems)
    .set({
      itemStatus: input.to,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${ticketItems.version} + 1`,
    })
    .where(
      and(
        eq(ticketItems.id, input.itemId),
        eq(ticketItems.ticketId, input.ticketId),
        eq(ticketItems.tenantId, input.tenantId),
        isNull(ticketItems.deletedAt),
      ),
    )
    .returning({ id: ticketItems.id });

  if (updatedRows[0]) {
    return { updated: true, exists: true };
  }

  const existing = await findTicketItemById(db, input);
  return { updated: false, exists: Boolean(existing) };
}

export async function softDeleteServiceTicketItemRecord(
  db: Database,
  input: {
    tenantId: string;
    ticketId: string;
    itemId: string;
    actorUserId: string;
  },
): Promise<boolean> {
  const updatedRows = await db
    .update(ticketItems)
    .set({
      deletedAt: new Date(),
      deletedBy: input.actorUserId,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${ticketItems.version} + 1`,
    })
    .where(
      and(
        eq(ticketItems.id, input.itemId),
        eq(ticketItems.ticketId, input.ticketId),
        eq(ticketItems.tenantId, input.tenantId),
        isNull(ticketItems.deletedAt),
      ),
    )
    .returning({ id: ticketItems.id });

  if (updatedRows[0]) {
    // Bump parent version so the ticket reflects the structural change.
    await db
      .update(serviceTickets)
      .set({
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
        version: sql`${serviceTickets.version} + 1`,
      })
      .where(eq(serviceTickets.id, input.ticketId));
    return true;
  }

  return false;
}
