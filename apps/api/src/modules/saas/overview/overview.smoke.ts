import assert from "node:assert/strict";

import "../../../config/env.js";

import {
  branches,
  closeDbConnection,
  getDb,
  orders,
  paymentTransactions,
  posPaymentAdjustments,
  tenants,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import {
  findTodayOrderCount,
  findTodayRevenueByCurrency,
} from "./overview.repository.js";

const ROLLBACK = new Error("SAAS_OVERVIEW_SMOKE_ROLLBACK");

async function run(): Promise<void> {
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      const beforeCount = await findTodayOrderCount(tx, "UTC");
      const beforeRevenue = new Map(
        (await findTodayRevenueByCurrency(tx, "UTC")).map((row) => [
          row.currency,
          row.amount,
        ]),
      );
      const tenantId = createId();
      const userId = createId();
      const branchId = createId();
      const oldOrderId = createId();
      const newOrderId = createId();
      const now = new Date();
      const yesterday = new Date(now.getTime() - 86_400_000);
      await tx.insert(tenants).values({
        id: tenantId,
        name: "SaaS overview smoke",
        pressingCode: `OVR-${createId()}`,
      });
      await tx.insert(users).values({
        id: userId,
        tenantId,
        userType: "tenant",
        status: "active",
        passwordHash: "not-used",
        pinHash: "not-used",
      });
      await tx
        .insert(branches)
        .values({ id: branchId, tenantId, name: "Smoke branch" });
      await tx.insert(orders).values([
        {
          id: oldOrderId,
          tenantId,
          branchId,
          createdBy: userId,
          status: "paid",
          subtotalAmount: "100",
          totalAmount: "100",
          paidAmount: "100",
          paymentStatus: "paid",
          createdAt: yesterday,
        },
        {
          id: newOrderId,
          tenantId,
          branchId,
          createdBy: userId,
          status: "paid",
          currency: "EUR",
          subtotalAmount: "50",
          totalAmount: "50",
          paidAmount: "50",
          paymentStatus: "paid",
          createdAt: now,
        },
      ]);
      await tx.insert(paymentTransactions).values([
        {
          id: createId(),
          tenantId,
          branchId,
          orderId: oldOrderId,
          paymentMethod: "cash",
          paymentStatus: "paid",
          amount: "100",
          currency: "XOF",
          paidAt: now,
        },
        {
          id: createId(),
          tenantId,
          branchId,
          orderId: oldOrderId,
          paymentMethod: "cash",
          paymentStatus: "refunded",
          amount: "-10",
          currency: "XOF",
          paidAt: now,
        },
        {
          id: createId(),
          tenantId,
          branchId,
          orderId: newOrderId,
          paymentMethod: "card",
          paymentStatus: "paid",
          amount: "50",
          currency: "EUR",
          paidAt: now,
        },
      ]);
      await tx.insert(posPaymentAdjustments).values([
        {
          id: createId(),
          tenantId,
          branchId,
          orderId: oldOrderId,
          originalPaymentId: null,
          adjustmentType: "refund",
          direction: "debit",
          status: "succeeded",
          amount: "5",
          currency: "XOF",
          idempotencyKey: createId(),
          reason: "Smoke refund",
          createdBy: userId,
          resolvedAt: now,
          occurredAt: now,
        },
        {
          id: createId(),
          tenantId,
          branchId,
          orderId: oldOrderId,
          originalPaymentId: null,
          adjustmentType: "correction",
          direction: "credit",
          status: "succeeded",
          amount: "2",
          currency: "XOF",
          idempotencyKey: createId(),
          reason: "Smoke correction",
          createdBy: userId,
          resolvedAt: now,
          occurredAt: now,
        },
        {
          id: createId(),
          tenantId,
          branchId,
          orderId: oldOrderId,
          originalPaymentId: null,
          adjustmentType: "refund",
          direction: "debit",
          status: "pending",
          amount: "30",
          currency: "XOF",
          idempotencyKey: createId(),
          reason: "Unsettled refund",
          createdBy: userId,
          occurredAt: now,
        },
      ]);
      assert.equal(await findTodayOrderCount(tx, "UTC"), beforeCount + 1);
      const afterRevenue = new Map(
        (await findTodayRevenueByCurrency(tx, "UTC")).map((row) => [
          row.currency,
          row.amount,
        ]),
      );
      assert.equal(
        afterRevenue.get("XOF"),
        (beforeRevenue.get("XOF") ?? 0) + 87,
      );
      assert.equal(
        afterRevenue.get("EUR"),
        (beforeRevenue.get("EUR") ?? 0) + 50,
      );
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  } finally {
    await closeDbConnection();
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
