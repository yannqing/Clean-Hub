import { and, asc, eq, sql } from "drizzle-orm";

import { receiptDeliveries, type Database } from "@cleanhub/db";

import type { PosReceiptDelivery } from "./receipts.types.js";

function toDelivery(
  row: typeof receiptDeliveries.$inferSelect,
): PosReceiptDelivery {
  return {
    id: row.id,
    orderId: row.orderId,
    channel: row.channel,
    destination: row.destination,
    status: row.status,
    receiptTitle: row.receiptTitle,
    provider: row.provider,
    externalId: row.externalId,
    failureReason: row.failureReason,
    attemptCount: row.attemptCount,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function findReceiptDeliveryRecord(
  db: Database,
  input: { tenantId: string; orderId: string; deliveryId: string },
) {
  const [row] = await db
    .select()
    .from(receiptDeliveries)
    .where(
      and(
        eq(receiptDeliveries.tenantId, input.tenantId),
        eq(receiptDeliveries.orderId, input.orderId),
        eq(receiptDeliveries.id, input.deliveryId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listReceiptDeliveries(
  db: Database,
  input: { tenantId: string; orderId: string },
): Promise<PosReceiptDelivery[]> {
  const rows = await db
    .select()
    .from(receiptDeliveries)
    .where(
      and(
        eq(receiptDeliveries.tenantId, input.tenantId),
        eq(receiptDeliveries.orderId, input.orderId),
      ),
    )
    .orderBy(asc(receiptDeliveries.createdAt));
  return rows.map(toDelivery);
}

export async function findReceiptDeliveryByIdempotencyKey(
  db: Database,
  input: { tenantId: string; idempotencyKey: string },
): Promise<PosReceiptDelivery | null> {
  const [row] = await db
    .select()
    .from(receiptDeliveries)
    .where(
      and(
        eq(receiptDeliveries.tenantId, input.tenantId),
        eq(receiptDeliveries.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  return row ? toDelivery(row) : null;
}

export async function insertReceiptDelivery(
  db: Database,
  input: typeof receiptDeliveries.$inferInsert,
): Promise<PosReceiptDelivery | null> {
  const [row] = await db
    .insert(receiptDeliveries)
    .values(input)
    .onConflictDoNothing()
    .returning();
  return row ? toDelivery(row) : null;
}

export async function updateReceiptDeliveryResult(
  db: Database,
  input: {
    tenantId: string;
    id: string;
    status: "sent" | "failed" | "skipped";
    provider?: string;
    externalId?: string;
    failureReason?: string;
    providerPayload?: Record<string, unknown>;
  },
): Promise<PosReceiptDelivery> {
  const [row] = await db
    .update(receiptDeliveries)
    .set({
      status: input.status,
      provider: input.provider,
      externalId: input.externalId,
      failureReason: input.failureReason,
      providerPayload: input.providerPayload,
      sentAt: input.status === "sent" ? new Date() : null,
      attemptCount: sql`${receiptDeliveries.attemptCount} + 1`,
      lastAttemptAt: new Date(),
    })
    .where(
      and(
        eq(receiptDeliveries.tenantId, input.tenantId),
        eq(receiptDeliveries.id, input.id),
      ),
    )
    .returning();
  if (!row) throw new Error("Receipt delivery result could not be saved.");
  return toDelivery(row);
}
