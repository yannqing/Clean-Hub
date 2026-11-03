import { and, desc, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";

import {
  posCarts,
  posChannelSettings,
  users,
  userProfiles,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { PosCartSnapshot, PosSavedCart } from "./carts.types.js";

function toSavedCart(
  row: typeof posCarts.$inferSelect,
  ownerName: string | null = null,
): PosSavedCart {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    terminalId: row.terminalId,
    userId: row.userId,
    ownerName,
    currency: row.currency,
    cart: row.payload as PosCartSnapshot,
    name: row.name,
    status: row.status,
    clientUpdatedAt: row.clientUpdatedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    parkedAt: row.parkedAt?.toISOString() ?? null,
    parkedBy: row.parkedBy,
    claimedAt: row.claimedAt?.toISOString() ?? null,
    claimedBy: row.claimedBy,
    handoffNote: row.handoffNote,
    updatedAt: row.updatedAt.toISOString(),
    version: row.version,
  };
}

export async function expirePosCarts(
  db: Database,
  input: { tenantId: string; branchId: string; now: Date },
): Promise<number> {
  const rows = await db
    .update(posCarts)
    .set({
      status: "abandoned",
      updatedAt: input.now,
      version: sql`${posCarts.version} + 1`,
    })
    .where(
      and(
        eq(posCarts.tenantId, input.tenantId),
        eq(posCarts.branchId, input.branchId),
        inArray(posCarts.status, ["active", "parked"]),
        lte(posCarts.expiresAt, input.now),
        isNull(posCarts.deletedAt),
      ),
    )
    .returning({ id: posCarts.id });
  return rows.length;
}

export async function listParkedPosCarts(
  db: Database,
  input: { tenantId: string; branchId: string; now: Date },
): Promise<PosSavedCart[]> {
  const rows = await db
    .select({ cart: posCarts, ownerName: userProfiles.displayName })
    .from(posCarts)
    .innerJoin(users, eq(users.id, posCarts.userId))
    .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
    .where(
      and(
        eq(posCarts.tenantId, input.tenantId),
        eq(posCarts.branchId, input.branchId),
        eq(posCarts.status, "parked"),
        gt(posCarts.expiresAt, input.now),
        isNull(posCarts.deletedAt),
      ),
    )
    .orderBy(desc(posCarts.parkedAt), desc(posCarts.updatedAt));
  return rows.map((row) => toSavedCart(row.cart, row.ownerName));
}

export async function parkActivePosCart(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    userId: string;
    name: string;
    handoffNote?: string | null;
  },
): Promise<PosSavedCart | null> {
  const now = new Date();
  const rows = await db
    .update(posCarts)
    .set({
      name: input.name,
      status: "parked",
      parkedAt: now,
      parkedBy: input.userId,
      handoffNote: input.handoffNote ?? null,
      updatedAt: now,
      updatedBy: input.userId,
      version: sql`${posCarts.version} + 1`,
    })
    .where(
      and(
        eq(posCarts.tenantId, input.tenantId),
        eq(posCarts.branchId, input.branchId),
        eq(posCarts.userId, input.userId),
        eq(posCarts.status, "active"),
        isNull(posCarts.deletedAt),
      ),
    )
    .returning();
  return rows[0] ? toSavedCart(rows[0]) : null;
}

export async function findParkedPosCartForUpdate(
  db: Database,
  input: { tenantId: string; branchId: string; cartId: string },
): Promise<PosSavedCart | null> {
  const rows = await db
    .select()
    .from(posCarts)
    .where(
      and(
        eq(posCarts.id, input.cartId),
        eq(posCarts.tenantId, input.tenantId),
        eq(posCarts.branchId, input.branchId),
        eq(posCarts.status, "parked"),
        isNull(posCarts.deletedAt),
      ),
    )
    .for("update")
    .limit(1);
  return rows[0] ? toSavedCart(rows[0]) : null;
}

export async function claimParkedPosCart(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    cartId: string;
    terminalId: string;
    userId: string;
    handoffNote?: string | null;
  },
): Promise<PosSavedCart | null> {
  const now = new Date();
  const rows = await db
    .update(posCarts)
    .set({
      terminalId: input.terminalId,
      userId: input.userId,
      status: "active",
      claimedAt: now,
      claimedBy: input.userId,
      handoffNote: input.handoffNote ?? sql`${posCarts.handoffNote}`,
      updatedAt: now,
      updatedBy: input.userId,
      version: sql`${posCarts.version} + 1`,
    })
    .where(
      and(
        eq(posCarts.id, input.cartId),
        eq(posCarts.tenantId, input.tenantId),
        eq(posCarts.branchId, input.branchId),
        eq(posCarts.status, "parked"),
        gt(posCarts.expiresAt, now),
        isNull(posCarts.deletedAt),
      ),
    )
    .returning();
  return rows[0] ? toSavedCart(rows[0]) : null;
}

export async function lockPosCartScope(
  db: Database,
  input: { tenantId: string; branchId: string; userId: string },
): Promise<void> {
  const key = `${input.tenantId}:${input.branchId}:${input.userId}`;
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`,
  );
}

export async function findActivePosCart(
  db: Database,
  input: { tenantId: string; branchId: string; userId: string },
): Promise<PosSavedCart | null> {
  const rows = await db
    .select()
    .from(posCarts)
    .where(
      and(
        eq(posCarts.tenantId, input.tenantId),
        eq(posCarts.branchId, input.branchId),
        eq(posCarts.userId, input.userId),
        eq(posCarts.status, "active"),
        isNull(posCarts.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ? toSavedCart(rows[0]) : null;
}

export async function findLivePosCart(
  db: Database,
  input: { tenantId: string; branchId: string; userId: string; now: Date },
): Promise<PosSavedCart | null> {
  const rows = await db
    .select()
    .from(posCarts)
    .where(
      and(
        eq(posCarts.tenantId, input.tenantId),
        eq(posCarts.branchId, input.branchId),
        eq(posCarts.userId, input.userId),
        eq(posCarts.status, "active"),
        gt(posCarts.expiresAt, input.now),
        isNull(posCarts.deletedAt),
      ),
    )
    .limit(1);
  return rows[0] ? toSavedCart(rows[0]) : null;
}

export async function getPosCartRetentionHours(
  db: Database,
  tenantId: string,
): Promise<number> {
  const rows = await db
    .select({ hours: posChannelSettings.recentCartRetentionHours })
    .from(posChannelSettings)
    .where(eq(posChannelSettings.tenantId, tenantId))
    .limit(1);
  return rows[0]?.hours ?? 24;
}

export async function insertPosCart(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    terminalId: string;
    userId: string;
    cart: PosCartSnapshot;
    expiresAt: Date;
  },
): Promise<PosSavedCart> {
  const rows = await db
    .insert(posCarts)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      terminalId: input.terminalId,
      userId: input.userId,
      currency: input.cart.currency,
      payload: input.cart,
      clientUpdatedAt: new Date(input.cart.updatedAt),
      expiresAt: input.expiresAt,
      createdBy: input.userId,
      updatedBy: input.userId,
    })
    .returning();
  return toSavedCart(rows[0]!);
}

export async function updatePosCart(
  db: Database,
  input: {
    id: string;
    tenantId: string;
    terminalId: string;
    userId: string;
    cart: PosCartSnapshot;
    expiresAt: Date;
  },
): Promise<PosSavedCart> {
  const rows = await db
    .update(posCarts)
    .set({
      terminalId: input.terminalId,
      currency: input.cart.currency,
      payload: input.cart,
      clientUpdatedAt: new Date(input.cart.updatedAt),
      expiresAt: input.expiresAt,
      updatedAt: new Date(),
      updatedBy: input.userId,
      version: sql`${posCarts.version} + 1`,
    })
    .where(
      and(
        eq(posCarts.id, input.id),
        eq(posCarts.tenantId, input.tenantId),
        eq(posCarts.status, "active"),
        isNull(posCarts.deletedAt),
      ),
    )
    .returning();
  if (!rows[0]) throw new Error("Active POS cart disappeared during update.");
  return toSavedCart(rows[0]);
}

export async function abandonActivePosCart(
  db: Database,
  input: { tenantId: string; branchId: string; userId: string },
): Promise<void> {
  await db
    .update(posCarts)
    .set({
      status: "abandoned",
      updatedAt: new Date(),
      updatedBy: input.userId,
      version: sql`${posCarts.version} + 1`,
    })
    .where(
      and(
        eq(posCarts.tenantId, input.tenantId),
        eq(posCarts.branchId, input.branchId),
        eq(posCarts.userId, input.userId),
        eq(posCarts.status, "active"),
        isNull(posCarts.deletedAt),
      ),
    );
}
