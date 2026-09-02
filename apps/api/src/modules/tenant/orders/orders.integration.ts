import assert from "node:assert/strict";

import "../../../config/env.js";

import { eq } from "drizzle-orm";

import {
  auditLogs,
  branchProductSettings,
  branches,
  closeDbConnection,
  customerAccounts,
  customers,
  getDb,
  orders,
  paymentTransactions,
  prices,
  productPrices,
  productSkus,
  products,
  serviceCategories,
  services,
  tenantFeatureFlags,
  tenants,
  userProfiles,
  users,
  type Database,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { AuthContext } from "../../auth/auth.types.js";
import { PosOrderError } from "../../pos/orders/orders.errors.js";
import {
  checkoutPosOrder,
  createPosOrder,
} from "../../pos/orders/orders.service.js";
import { updateTenantService } from "../services/services.service.js";
import {
  createTenantOrderItem,
  createTenantOrderPayment,
  createTenantOrderPaymentCorrection,
  createTenantOrderRefund,
  deleteTenantOrderItem,
  getTenantOrderDetail,
  updateTenantOrderItem,
} from "./orders.service.js";

class ExpectedIntegrationRollback extends Error {}

type FixtureIds = ReturnType<typeof createFixtureIds>;

function reuseOuterTransaction(transaction: Database): Database {
  Object.defineProperty(transaction, "transaction", {
    configurable: true,
    value: async (callback: (db: Database) => Promise<unknown>) =>
      callback(transaction),
  });
  return transaction;
}

function createFixtureIds() {
  return {
    tenantId: createId(),
    userId: createId(),
    branchId: createId(),
    secondBranchId: createId(),
    customerAccountId: createId(),
    customerId: createId(),
    serviceCategoryId: createId(),
    retailCategoryId: createId(),
    firstServiceId: createId(),
    secondServiceId: createId(),
    retailServiceId: createId(),
    firstPriceId: createId(),
    secondPriceId: createId(),
    retailPriceId: createId(),
    retailProductId: createId(),
    retailProductSkuId: createId(),
    retailProductPriceId: createId(),
    retailProductBranchSettingId: createId(),
    orderId: createId(),
    guestOrderId: createId(),
    checkoutOrderId: createId(),
    unavailableBranchOrderId: createId(),
    rejectedGuestServiceOrderId: createId(),
  };
}

function createOwnerContext(ids: FixtureIds): AuthContext {
  return {
    userId: ids.userId,
    displayName: "Tenant order integration owner",
    tenantId: ids.tenantId,
    branchIds: [],
    role: "owner",
    roles: ["owner"],
    permissions: [],
    accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

async function insertFixtures(db: Database, ids: FixtureIds): Promise<void> {
  const uniqueSuffix = ids.tenantId.toLowerCase();

  await db.insert(tenants).values({
    id: ids.tenantId,
    name: "Tenant order integration test",
    pressingCode: `INT-${uniqueSuffix}`,
    status: "active",
  });
  await db.insert(tenantFeatureFlags).values({
    id: createId(),
    tenantId: ids.tenantId,
    laundryEnabled: true,
    retailProductsEnabled: true,
  });
  await db.insert(users).values({
    id: ids.userId,
    tenantId: ids.tenantId,
    userType: "tenant",
    email: `${uniqueSuffix}@integration.cleanhub.local`,
    normalizedEmail: `${uniqueSuffix}@integration.cleanhub.local`,
    passwordHash: "integration-test-only",
    pinHash: "integration-test-only",
    status: "active",
  });
  await db.insert(userProfiles).values({
    userId: ids.userId,
    tenantId: ids.tenantId,
    displayName: "Tenant order integration owner",
    language: "en",
    timezone: "UTC",
  });
  await db.insert(branches).values({
    id: ids.branchId,
    tenantId: ids.tenantId,
    name: "Integration branch",
    defaultCurrency: "CNY",
    status: "active",
    createdBy: ids.userId,
  });
  await db.insert(branches).values({
    id: ids.secondBranchId,
    tenantId: ids.tenantId,
    name: "Integration second branch",
    defaultCurrency: "CNY",
    status: "active",
    createdBy: ids.userId,
  });
  await db.insert(customerAccounts).values({
    id: ids.customerAccountId,
    tenantId: ids.tenantId,
    accountName: "Integration customer account",
    email: `customer-${uniqueSuffix}@integration.cleanhub.local`,
    status: "active",
    createdBy: ids.userId,
  });
  await db.insert(customers).values({
    id: ids.customerId,
    customerAccountId: ids.customerAccountId,
    tenantId: ids.tenantId,
    fullName: "Integration customer",
    status: "active",
    createdBy: ids.userId,
  });
  await db.insert(serviceCategories).values([
    {
      id: ids.serviceCategoryId,
      tenantId: ids.tenantId,
      name: "Integration laundry",
      businessLine: "laundry",
      status: "active",
      createdBy: ids.userId,
    },
    {
      id: ids.retailCategoryId,
      tenantId: ids.tenantId,
      name: "Integration retail",
      businessLine: "retail",
      status: "active",
      createdBy: ids.userId,
    },
  ]);
  await db.insert(services).values([
    {
      id: ids.firstServiceId,
      tenantId: ids.tenantId,
      categoryId: ids.serviceCategoryId,
      name: "Integration shirt cleaning",
      businessLine: "laundry",
      pricingUnit: "per_item",
      labelRule: "per_item",
      status: "active",
      createdBy: ids.userId,
    },
    {
      id: ids.secondServiceId,
      tenantId: ids.tenantId,
      categoryId: ids.serviceCategoryId,
      name: "Integration suit cleaning",
      businessLine: "laundry",
      pricingUnit: "per_item",
      labelRule: "per_item",
      status: "active",
      createdBy: ids.userId,
    },
    {
      id: ids.retailServiceId,
      tenantId: ids.tenantId,
      categoryId: ids.retailCategoryId,
      name: "Integration fabric freshener",
      businessLine: "retail",
      pricingUnit: "per_item",
      labelRule: "none",
      status: "active",
      createdBy: ids.userId,
    },
  ]);
  await db.insert(prices).values([
    {
      id: ids.firstPriceId,
      tenantId: ids.tenantId,
      serviceId: ids.firstServiceId,
      amount: "15.00",
      currency: "CNY",
      status: "active",
      createdBy: ids.userId,
    },
    {
      id: ids.secondPriceId,
      tenantId: ids.tenantId,
      serviceId: ids.secondServiceId,
      amount: "40.00",
      currency: "CNY",
      status: "active",
      createdBy: ids.userId,
    },
    {
      id: ids.retailPriceId,
      tenantId: ids.tenantId,
      serviceId: ids.retailServiceId,
      amount: "12.00",
      currency: "CNY",
      status: "active",
      createdBy: ids.userId,
    },
  ]);
  await db.insert(products).values({
    id: ids.retailProductId,
    tenantId: ids.tenantId,
    name: "Integration retail product",
    status: "active",
    createdBy: ids.userId,
  });
  await db.insert(productSkus).values({
    id: ids.retailProductSkuId,
    tenantId: ids.tenantId,
    productId: ids.retailProductId,
    skuCode: `TEST-${ids.retailProductSkuId}`,
    unitOfMeasure: "piece",
    trackInventory: false,
    status: "active",
    createdBy: ids.userId,
  });
  await db.insert(productPrices).values({
    id: ids.retailProductPriceId,
    tenantId: ids.tenantId,
    productSkuId: ids.retailProductSkuId,
    amount: "9.00",
    currency: "CNY",
    status: "active",
    createdBy: ids.userId,
  });
  await db.insert(branchProductSettings).values({
    id: ids.retailProductBranchSettingId,
    tenantId: ids.tenantId,
    branchId: ids.branchId,
    productSkuId: ids.retailProductSkuId,
    isAvailable: true,
    createdBy: ids.userId,
  });
}

function isPosOrderError(code: PosOrderError["code"]) {
  return (error: unknown): boolean =>
    error instanceof PosOrderError && error.code === code;
}

async function runOrderLifecycleAssertions(
  db: Database,
  ids: FixtureIds,
): Promise<void> {
  const authContext = createOwnerContext(ids);
  const requestMeta = {
    ipAddress: "127.0.0.1",
    userAgent: "tenant-order-integration-test",
  };

  await insertFixtures(db, ids);
  const branchScopedService = await updateTenantService(
    authContext,
    ids.retailServiceId,
    {
      version: 1,
      allBranches: false,
      branchSettings: [
        {
          branchId: ids.branchId,
          isAvailable: true,
          priceOverrideAmount: "9.00",
          turnaroundMinutesOverride: 30,
        },
      ],
    },
    requestMeta,
    db,
  );
  assert.equal(branchScopedService.allBranches, false);
  assert.equal(branchScopedService.branchSettings.length, 1);
  assert.equal(
    branchScopedService.branchSettings[0]?.priceOverrideAmount,
    "9.00",
  );

  const checkoutInput = {
    expectedTotalAmount: "18.00",
    settlementIntent: "pay_now" as const,
    order: {
      id: ids.checkoutOrderId,
      orderType: "manual" as const,
      branchId: ids.branchId,
      items: [{ productSkuId: ids.retailProductSkuId, quantity: "2" }],
    },
    payment: {
      paymentMethod: "cash" as const,
      idempotencyKey: ids.checkoutOrderId,
    },
  };
  const checkout = await checkoutPosOrder(
    authContext,
    checkoutInput,
    requestMeta,
    db,
  );
  assert.equal(checkout.order.totalAmount, "18.00");
  assert.equal(checkout.order.paymentStatus, "paid");
  assert.equal(checkout.payment?.paymentStatus, "paid");
  assert.equal(checkout.idempotent, false);

  const retriedCheckout = await checkoutPosOrder(
    authContext,
    checkoutInput,
    requestMeta,
    db,
  );
  assert.equal(retriedCheckout.order.id, ids.checkoutOrderId);
  assert.equal(retriedCheckout.idempotent, true);
  const checkoutPayments = await db
    .select({ id: paymentTransactions.id })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.orderId, ids.checkoutOrderId));
  assert.equal(
    checkoutPayments.length,
    1,
    "power-loss replay must not create a second checkout payment",
  );

  const guestOrder = await createPosOrder(
    {
      authContext,
      requestMeta,
      data: {
        id: ids.guestOrderId,
        orderType: "manual",
        branchId: ids.branchId,
        items: [{ productSkuId: ids.retailProductSkuId, quantity: "2" }],
      },
    },
    db,
  );
  assert.equal(guestOrder.customerId, null);
  assert.equal(guestOrder.customerName, null);
  assert.equal(guestOrder.totalAmount, "18.00");
  assert.equal(guestOrder.items[0]?.productSkuId, ids.retailProductSkuId);

  const paidGuestOrder = await createTenantOrderPayment(
    authContext,
    ids.guestOrderId,
    {
      paymentMethod: "cash",
      amount: "18.00",
      idempotencyKey: `guest-payment-${ids.guestOrderId}`,
    },
    requestMeta,
    db,
  );
  assert.equal(paidGuestOrder.customerId, null);
  assert.equal(paidGuestOrder.paymentStatus, "paid");

  const guestPayment = paidGuestOrder.payments[0];
  assert.ok(guestPayment, "the guest payment must be returned");
  const guestPaymentRows = await db
    .select({ customerId: paymentTransactions.customerId })
    .from(paymentTransactions)
    .where(eq(paymentTransactions.id, guestPayment.id));
  assert.equal(guestPaymentRows[0]?.customerId, null);
  const refundedGuestOrder = await createTenantOrderRefund(
    authContext,
    ids.guestOrderId,
    {
      originalPaymentId: guestPayment.id,
      amount: "18.00",
      idempotencyKey: `guest-refund-${ids.guestOrderId}`,
      reason: "Integration guest refund",
    },
    requestMeta,
    db,
  );
  assert.equal(refundedGuestOrder.customerId, null);
  assert.equal(refundedGuestOrder.paymentStatus, "refunded");

  await assert.rejects(
    createPosOrder(
      {
        authContext,
        requestMeta,
        data: {
          id: ids.unavailableBranchOrderId,
          orderType: "manual",
          branchId: ids.secondBranchId,
          items: [{ serviceId: ids.retailServiceId, quantity: "1" }],
        },
      },
      db,
    ),
    isPosOrderError("VALIDATION_ERROR"),
    "a service must not be sold from an unassigned branch",
  );

  await assert.rejects(
    createPosOrder(
      {
        authContext,
        requestMeta,
        data: {
          id: ids.rejectedGuestServiceOrderId,
          orderType: "manual",
          branchId: ids.branchId,
          items: [{ serviceId: ids.firstServiceId, quantity: "1" }],
        },
      },
      db,
    ),
    isPosOrderError("CUSTOMER_REQUIRED"),
    "guest orders must reject non-retail services",
  );

  await createPosOrder(
    {
      authContext,
      requestMeta,
      data: {
        id: ids.orderId,
        orderType: "manual",
        branchId: ids.branchId,
        customerId: ids.customerId,
        notes: "Disposable integration order",
        items: [{ serviceId: ids.firstServiceId, quantity: "2" }],
      },
    },
    db,
  );

  const created = await getTenantOrderDetail(authContext, ids.orderId, db);
  assert.equal(created.items.length, 1);
  assert.equal(created.subtotalAmount, "30.00");
  assert.equal(created.totalAmount, "30.00");
  assert.equal(created.paymentStatus, "unpaid");
  assert.equal(created.capabilities.canEdit, true);
  assert.deepEqual(created.paymentAdjustments, []);

  const afterAdd = await createTenantOrderItem(
    authContext,
    ids.orderId,
    {
      serviceId: ids.secondServiceId,
      quantity: "1",
      itemColor: "navy",
      itemIdentifier: "INT-SUIT-1",
    },
    requestMeta,
    db,
  );
  assert.equal(afterAdd.items.length, 2);
  assert.equal(afterAdd.totalAmount, "70.00");
  const addedItem = afterAdd.items.find(
    (item) => item.serviceId === ids.secondServiceId,
  );
  assert.ok(addedItem, "the added order item must be returned");

  const afterUpdate = await updateTenantOrderItem(
    authContext,
    ids.orderId,
    addedItem.id,
    {
      quantity: "2",
      specialRequest: "Use fragrance-free detergent",
      version: addedItem.version,
    },
    requestMeta,
    db,
  );
  assert.equal(afterUpdate.totalAmount, "110.00");
  assert.equal(
    afterUpdate.items.find((item) => item.id === addedItem.id)?.specialRequest,
    "Use fragrance-free detergent",
  );

  await assert.rejects(
    updateTenantOrderItem(
      authContext,
      ids.orderId,
      addedItem.id,
      { quantity: "3", version: addedItem.version },
      requestMeta,
      db,
    ),
    isPosOrderError("VERSION_CONFLICT"),
    "stale item versions must be rejected",
  );

  const afterDelete = await deleteTenantOrderItem(
    authContext,
    ids.orderId,
    addedItem.id,
    { reason: "Integration test removal" },
    requestMeta,
    db,
  );
  assert.equal(afterDelete.items.length, 1);
  assert.equal(afterDelete.totalAmount, "30.00");

  const paymentInput = {
    paymentMethod: "cash" as const,
    amount: "20.00",
    idempotencyKey: `payment-${ids.orderId}`,
  };
  const afterPayment = await createTenantOrderPayment(
    authContext,
    ids.orderId,
    paymentInput,
    requestMeta,
    db,
  );
  assert.equal(afterPayment.paidAmount, "20.00");
  assert.equal(afterPayment.paymentStatus, "partial");
  assert.equal(afterPayment.payments.length, 1);
  assert.equal(afterPayment.capabilities.canEdit, false);
  const payment = afterPayment.payments[0];
  assert.ok(payment, "the recorded payment must be returned");

  const retriedPayment = await createTenantOrderPayment(
    authContext,
    ids.orderId,
    paymentInput,
    requestMeta,
    db,
  );
  assert.equal(retriedPayment.payments.length, 1);
  assert.equal(retriedPayment.paidAmount, "20.00");

  await assert.rejects(
    createTenantOrderItem(
      authContext,
      ids.orderId,
      { serviceId: ids.secondServiceId, quantity: "1" },
      requestMeta,
      db,
    ),
    isPosOrderError("ORDER_ALREADY_PAID"),
    "orders with a paid amount must reject item changes",
  );

  const refundInput = {
    originalPaymentId: payment.id,
    amount: "5.00",
    idempotencyKey: `refund-${ids.orderId}`,
    reason: "Integration partial refund",
  };
  const afterRefund = await createTenantOrderRefund(
    authContext,
    ids.orderId,
    refundInput,
    requestMeta,
    db,
  );
  assert.equal(afterRefund.paidAmount, "15.00");
  assert.equal(afterRefund.paymentAdjustments.length, 1);

  const retriedRefund = await createTenantOrderRefund(
    authContext,
    ids.orderId,
    refundInput,
    requestMeta,
    db,
  );
  assert.equal(retriedRefund.paidAmount, "15.00");
  assert.equal(retriedRefund.paymentAdjustments.length, 1);

  const debitCorrectionInput = {
    originalPaymentId: payment.id,
    direction: "debit" as const,
    amount: "3.00",
    idempotencyKey: `correction-debit-${ids.orderId}`,
    reason: "Integration debit correction",
  };
  const afterDebitCorrection = await createTenantOrderPaymentCorrection(
    authContext,
    ids.orderId,
    debitCorrectionInput,
    requestMeta,
    db,
  );
  assert.equal(afterDebitCorrection.paidAmount, "12.00");
  assert.equal(afterDebitCorrection.paymentAdjustments.length, 2);

  const retriedDebitCorrection = await createTenantOrderPaymentCorrection(
    authContext,
    ids.orderId,
    debitCorrectionInput,
    requestMeta,
    db,
  );
  assert.equal(retriedDebitCorrection.paidAmount, "12.00");
  assert.equal(retriedDebitCorrection.paymentAdjustments.length, 2);

  const afterCreditCorrection = await createTenantOrderPaymentCorrection(
    authContext,
    ids.orderId,
    {
      originalPaymentId: payment.id,
      direction: "credit",
      amount: "2.00",
      idempotencyKey: `correction-credit-${ids.orderId}`,
      reason: "Integration credit correction",
    },
    requestMeta,
    db,
  );
  assert.equal(afterCreditCorrection.paidAmount, "14.00");
  assert.equal(afterCreditCorrection.paymentAdjustments.length, 3);

  await assert.rejects(
    createTenantOrderRefund(
      authContext,
      ids.orderId,
      {
        originalPaymentId: payment.id,
        amount: "15.00",
        idempotencyKey: `refund-overpaid-${ids.orderId}`,
        reason: "Integration excessive refund",
      },
      requestMeta,
      db,
    ),
    isPosOrderError("PAYMENT_AMOUNT_EXCEEDED"),
    "refunds must not exceed the current aggregate paid amount",
  );

  const fullyRefunded = await createTenantOrderRefund(
    authContext,
    ids.orderId,
    {
      originalPaymentId: payment.id,
      amount: "14.00",
      idempotencyKey: `refund-final-${ids.orderId}`,
      reason: "Integration final refund",
    },
    requestMeta,
    db,
  );
  assert.equal(fullyRefunded.paidAmount, "0.00");
  assert.equal(fullyRefunded.paymentStatus, "refunded");
  assert.equal(fullyRefunded.paymentAdjustments.length, 4);
  assert.equal(fullyRefunded.capabilities.canRefundPayments, false);
  assert.equal(fullyRefunded.capabilities.canCorrectPayments, true);

  const orderAuditRows = await db
    .select({ eventType: auditLogs.eventType })
    .from(auditLogs)
    .where(eq(auditLogs.tenantId, ids.tenantId));
  const eventTypes = new Set(orderAuditRows.map((item) => item.eventType));
  for (const eventType of [
    "pos.order.created",
    "pos.order.item_added",
    "pos.order.item_updated",
    "pos.order.item_deleted",
    "pos.order.payment_created",
    "pos.order.payment_refunded",
    "pos.order.payment_corrected",
  ]) {
    assert.ok(eventTypes.has(eventType), `timeline must include ${eventType}`);
  }
}

export async function runTenantOrderIntegrationTest(): Promise<void> {
  const db = getDb();
  const ids = createFixtureIds();
  let assertionsCompleted = false;

  try {
    await db.transaction(async (transaction) => {
      const transactionDb = reuseOuterTransaction(
        transaction as unknown as Database,
      );
      await runOrderLifecycleAssertions(transactionDb, ids);
      assertionsCompleted = true;
      throw new ExpectedIntegrationRollback();
    });
  } catch (error) {
    if (!(error instanceof ExpectedIntegrationRollback)) {
      throw error;
    }
  }

  assert.equal(assertionsCompleted, true);
  assert.deepEqual(
    await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.id, ids.tenantId)),
    [],
    "the integration tenant must be rolled back",
  );
  assert.deepEqual(
    await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, ids.orderId)),
    [],
    "the integration order must be rolled back",
  );
  assert.deepEqual(
    await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, ids.guestOrderId)),
    [],
    "the guest integration order must be rolled back",
  );
  assert.deepEqual(
    await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.id, ids.checkoutOrderId)),
    [],
    "the checkout integration order must be rolled back",
  );
}

if (process.argv[1]?.endsWith("orders.integration.ts")) {
  try {
    await runTenantOrderIntegrationTest();
    console.log("Tenant order integration test passed with a clean rollback.");
  } finally {
    await closeDbConnection();
  }
}
