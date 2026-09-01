import {
  branchProductSettings,
  inventoryBalances,
  inventoryMovements,
  inventoryReservations,
  orderItems,
  orders,
  productSkus,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";

import { PosOrderError } from "./orders.errors.js";

export type ReservableProductOrderItem = {
  orderItemId: string;
  productSkuId: string | null;
  quantity: string;
  trackInventory: boolean;
  allowNegativeStock: boolean;
};

export function assertProductStockCanBeReserved(input: {
  onHandQuantity: string;
  reservedQuantity: string;
  requestedQuantity: string;
  allowNegativeStock: boolean;
}): void {
  const requested = Number(input.requestedQuantity);
  const available =
    Number(input.onHandQuantity) - Number(input.reservedQuantity);
  if (!input.allowNegativeStock && available < requested) {
    throw new PosOrderError(
      "INSUFFICIENT_STOCK",
      `Only ${Math.max(available, 0)} unit(s) are available for this product.`,
      422,
    );
  }
}

export function getProductReservationExpiresAt(now = new Date()): Date {
  const configuredMinutes = Number(
    process.env.POS_PRODUCT_RESERVATION_TTL_MINUTES ?? "30",
  );
  const ttlMinutes =
    Number.isFinite(configuredMinutes) && configuredMinutes >= 5
      ? Math.min(configuredMinutes, 24 * 60)
      : 30;
  return new Date(now.getTime() + ttlMinutes * 60 * 1000);
}

export async function releaseExpiredProductReservations(
  db: Database,
  input: {
    tenantId: string;
    branchId?: string;
    actorUserId: string;
    now?: Date;
  },
): Promise<number> {
  const now = input.now ?? new Date();
  const reservations = await db
    .select()
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.tenantId, input.tenantId),
        eq(inventoryReservations.status, "active"),
        lte(inventoryReservations.expiresAt, now),
        ...(input.branchId
          ? [eq(inventoryReservations.branchId, input.branchId)]
          : []),
      ),
    )
    .for("update");

  for (const reservation of reservations) {
    await db
      .update(inventoryBalances)
      .set({
        reservedQuantity: sql`greatest(${inventoryBalances.reservedQuantity} - ${reservation.quantity}, 0)`,
        updatedAt: now,
        updatedBy: input.actorUserId,
        version: sql`${inventoryBalances.version} + 1`,
      })
      .where(
        and(
          eq(inventoryBalances.tenantId, input.tenantId),
          eq(inventoryBalances.branchId, reservation.branchId),
          eq(inventoryBalances.productSkuId, reservation.productSkuId),
        ),
      );
  }

  if (reservations.length > 0) {
    await db
      .update(inventoryReservations)
      .set({
        status: "expired",
        updatedAt: now,
        updatedBy: input.actorUserId,
        version: sql`${inventoryReservations.version} + 1`,
      })
      .where(
        and(
          eq(inventoryReservations.tenantId, input.tenantId),
          inArray(
            inventoryReservations.id,
            reservations.map((reservation) => reservation.id),
          ),
          eq(inventoryReservations.status, "active"),
        ),
      );
  }

  return reservations.length;
}

export async function reserveProductOrderItem(
  db: Database,
  input: {
    tenantId: string;
    branchId: string;
    orderId: string;
    actorUserId: string;
    expiresAt?: Date;
    item: ReservableProductOrderItem;
  },
): Promise<void> {
  if (!input.item.trackInventory || !input.item.productSkuId) {
    return;
  }

  // Lock an existing reservation before its balance so reserve/release paths
  // use the same lock order. This also makes retries safe if the reservation
  // was already restored by another transaction.
  const existingReservations = await db
    .select()
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.tenantId, input.tenantId),
        eq(inventoryReservations.orderItemId, input.item.orderItemId),
      ),
    )
    .for("update")
    .limit(1);
  const existingReservation = existingReservations[0];
  if (
    existingReservation?.status === "active" &&
    existingReservation.productSkuId === input.item.productSkuId &&
    Number(existingReservation.quantity) === Number(input.item.quantity)
  ) {
    return;
  }
  if (existingReservation?.status === "active") {
    throw new Error(
      "An active product reservation must be released before it can be changed.",
    );
  }

  const balances = await db
    .select()
    .from(inventoryBalances)
    .where(
      and(
        eq(inventoryBalances.tenantId, input.tenantId),
        eq(inventoryBalances.branchId, input.branchId),
        eq(inventoryBalances.productSkuId, input.item.productSkuId),
      ),
    )
    .limit(1)
    .for("update");
  const balance = balances[0];
  if (!balance) {
    throw new PosOrderError(
      "INSUFFICIENT_STOCK",
      "The selected product has no inventory balance at this branch.",
      422,
    );
  }

  assertProductStockCanBeReserved({
    onHandQuantity: balance.onHandQuantity,
    reservedQuantity: balance.reservedQuantity,
    requestedQuantity: input.item.quantity,
    allowNegativeStock: input.item.allowNegativeStock,
  });

  await db
    .update(inventoryBalances)
    .set({
      reservedQuantity: sql`${inventoryBalances.reservedQuantity} + ${input.item.quantity}`,
      updatedAt: new Date(),
      updatedBy: input.actorUserId,
      version: sql`${inventoryBalances.version} + 1`,
    })
    .where(
      and(
        eq(inventoryBalances.id, balance.id),
        eq(inventoryBalances.tenantId, input.tenantId),
      ),
    );

  const expiresAt = input.expiresAt ?? getProductReservationExpiresAt();
  await db
    .insert(inventoryReservations)
    .values({
      id: createId(),
      tenantId: input.tenantId,
      branchId: input.branchId,
      productSkuId: input.item.productSkuId,
      orderId: input.orderId,
      orderItemId: input.item.orderItemId,
      quantity: input.item.quantity,
      status: "active",
      expiresAt,
      createdBy: input.actorUserId,
      updatedBy: input.actorUserId,
    })
    .onConflictDoUpdate({
      target: [
        inventoryReservations.tenantId,
        inventoryReservations.orderItemId,
      ],
      set: {
        branchId: input.branchId,
        productSkuId: input.item.productSkuId,
        orderId: input.orderId,
        quantity: input.item.quantity,
        status: "active",
        expiresAt,
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
        version: sql`${inventoryReservations.version} + 1`,
      },
    });
}

async function ensureProductOrderReservations(
  db: Database,
  input: {
    tenantId: string;
    orderId: string;
    actorUserId: string;
  },
): Promise<void> {
  const rows = await db
    .select({
      orderItemId: orderItems.id,
      branchId: orderItems.branchId,
      productSkuId: orderItems.productSkuId,
      quantity: orderItems.quantity,
      trackInventory: productSkus.trackInventory,
      allowNegativeStock: branchProductSettings.allowNegativeStock,
      reservationStatus: inventoryReservations.status,
    })
    .from(orderItems)
    .innerJoin(
      productSkus,
      and(
        eq(productSkus.tenantId, orderItems.tenantId),
        eq(productSkus.id, orderItems.productSkuId),
        isNull(productSkus.deletedAt),
      ),
    )
    .innerJoin(
      branchProductSettings,
      and(
        eq(branchProductSettings.tenantId, orderItems.tenantId),
        eq(branchProductSettings.branchId, orderItems.branchId),
        eq(branchProductSettings.productSkuId, orderItems.productSkuId),
      ),
    )
    .leftJoin(
      inventoryReservations,
      and(
        eq(inventoryReservations.tenantId, orderItems.tenantId),
        eq(inventoryReservations.orderItemId, orderItems.id),
      ),
    )
    .where(
      and(
        eq(orderItems.tenantId, input.tenantId),
        eq(orderItems.orderId, input.orderId),
        eq(orderItems.itemKind, "product"),
        isNull(orderItems.deletedAt),
      ),
    );

  for (const item of rows) {
    if (!item.trackInventory || item.reservationStatus === "active") continue;
    await reserveProductOrderItem(db, {
      tenantId: input.tenantId,
      branchId: item.branchId,
      orderId: input.orderId,
      actorUserId: input.actorUserId,
      item: {
        orderItemId: item.orderItemId,
        productSkuId: item.productSkuId,
        quantity: item.quantity,
        trackInventory: item.trackInventory,
        allowNegativeStock: item.allowNegativeStock,
      },
    });
  }
}

export async function releaseProductOrderReservations(
  db: Database,
  input: {
    tenantId: string;
    orderId: string;
    actorUserId: string;
    orderItemIds?: string[];
  },
): Promise<void> {
  if (input.orderItemIds?.length === 0) {
    return;
  }
  const reservations = await db
    .select()
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.tenantId, input.tenantId),
        eq(inventoryReservations.orderId, input.orderId),
        eq(inventoryReservations.status, "active"),
        ...(input.orderItemIds
          ? [inArray(inventoryReservations.orderItemId, input.orderItemIds)]
          : []),
      ),
    )
    .for("update");

  for (const reservation of reservations) {
    await db
      .update(inventoryBalances)
      .set({
        reservedQuantity: sql`greatest(${inventoryBalances.reservedQuantity} - ${reservation.quantity}, 0)`,
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
        version: sql`${inventoryBalances.version} + 1`,
      })
      .where(
        and(
          eq(inventoryBalances.tenantId, input.tenantId),
          eq(inventoryBalances.branchId, reservation.branchId),
          eq(inventoryBalances.productSkuId, reservation.productSkuId),
        ),
      );
  }

  if (reservations.length > 0) {
    await db
      .update(inventoryReservations)
      .set({
        status: "released",
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
        version: sql`${inventoryReservations.version} + 1`,
      })
      .where(
        and(
          eq(inventoryReservations.tenantId, input.tenantId),
          inArray(
            inventoryReservations.id,
            reservations.map((reservation) => reservation.id),
          ),
          eq(inventoryReservations.status, "active"),
        ),
      );
  }
}

export async function consumeProductInventoryForPaidOrder(
  db: Database,
  input: { tenantId: string; orderId: string; actorUserId: string },
): Promise<void> {
  const orderRows = await db
    .select({ paymentStatus: orders.paymentStatus })
    .from(orders)
    .where(
      and(
        eq(orders.tenantId, input.tenantId),
        eq(orders.id, input.orderId),
        isNull(orders.deletedAt),
      ),
    )
    .limit(1);
  if (orderRows[0]?.paymentStatus !== "paid") {
    return;
  }

  await releaseExpiredProductReservations(db, {
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
  });
  await ensureProductOrderReservations(db, input);

  const reservations = await db
    .select()
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.tenantId, input.tenantId),
        eq(inventoryReservations.orderId, input.orderId),
        eq(inventoryReservations.status, "active"),
      ),
    )
    .for("update");

  for (const reservation of reservations) {
    await db
      .update(inventoryBalances)
      .set({
        onHandQuantity: sql`${inventoryBalances.onHandQuantity} - ${reservation.quantity}`,
        reservedQuantity: sql`greatest(${inventoryBalances.reservedQuantity} - ${reservation.quantity}, 0)`,
        lastMovementAt: new Date(),
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
        version: sql`${inventoryBalances.version} + 1`,
      })
      .where(
        and(
          eq(inventoryBalances.tenantId, input.tenantId),
          eq(inventoryBalances.branchId, reservation.branchId),
          eq(inventoryBalances.productSkuId, reservation.productSkuId),
        ),
      );

    await db.insert(inventoryMovements).values({
      id: createId(),
      tenantId: input.tenantId,
      branchId: reservation.branchId,
      productSkuId: reservation.productSkuId,
      movementType: "sale",
      quantityDelta: String(-Number(reservation.quantity)),
      referenceType: "pos_order",
      referenceId: input.orderId,
      orderItemId: reservation.orderItemId,
      idempotencyKey: `pos-order:${input.orderId}:item:${reservation.orderItemId}:sale`,
      reason: "POS order paid",
      createdBy: input.actorUserId,
    });
  }

  if (reservations.length > 0) {
    await db
      .update(inventoryReservations)
      .set({
        status: "consumed",
        updatedAt: new Date(),
        updatedBy: input.actorUserId,
        version: sql`${inventoryReservations.version} + 1`,
      })
      .where(
        and(
          eq(inventoryReservations.tenantId, input.tenantId),
          inArray(
            inventoryReservations.id,
            reservations.map((reservation) => reservation.id),
          ),
          eq(inventoryReservations.status, "active"),
        ),
      );
  }
}
