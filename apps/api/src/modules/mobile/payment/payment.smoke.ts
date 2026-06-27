import { MockPaymentGateway } from "./mock-payment.gateway.js";
import { addAmounts, subtractAmounts, compareAmounts } from "./payment-money.js";
import { PaymentService, type PaymentRepositoryLike } from "./payment.service.js";
import { PaymentError } from "./payment.types.js";
import type {
  CustomerPaymentTransaction,
  RefundRequest,
} from "./payment.types.js";
import type { PaymentOrderRecord } from "./payment.repository.js";
import type { MobileAuthContext } from "../auth/auth.types.js";
import type {
  NotificationEvent,
  NotificationPublishResult,
} from "../../notifications/index.js";

const now = new Date().toISOString();
const mockSecret = "payment-smoke-secret";
const gateway = new MockPaymentGateway({
  secret: mockSecret,
  paymentBaseUrl: "http://localhost:3002",
});

const customerContext: MobileAuthContext = {
  subjectType: "customer",
  subjectId: "account_1",
  displayName: "Customer One",
  tenantId: "tenant_1",
  branchIds: [],
  role: "customer",
  roles: ["customer"],
  permissions: [],
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
};

const otherCustomerContext: MobileAuthContext = {
  ...customerContext,
  subjectId: "account_2",
};

const ownerContext: MobileAuthContext = {
  subjectType: "staff",
  subjectId: "owner_1",
  displayName: "Owner One",
  tenantId: "tenant_1",
  branchIds: ["branch_1"],
  role: "owner",
  roles: ["owner"],
  permissions: [],
  accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
};

const restrictedOwnerContext: MobileAuthContext = {
  ...ownerContext,
  subjectId: "owner_2",
  branchIds: ["branch_2"],
};

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function assertRejectsPayment(
  action: () => Promise<unknown>,
  status: number,
): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (!(error instanceof PaymentError)) {
      throw new Error("expected a PaymentError");
    }

    assert(error.status === status, `expected status ${status}`);
    return;
  }

  throw new Error(`expected action to reject with ${status}`);
}

function makeTransaction(input: {
  id: string;
  orderId: string;
  amount: string;
  idempotencyKey: string;
}): CustomerPaymentTransaction {
  return {
    id: input.id,
    tenantId: "tenant_1",
    branchId: "branch_1",
    customerId: "customer_1",
    orderId: input.orderId,
    amount: input.amount,
    paymentStatus: "pending",
    idempotencyKey: input.idempotencyKey,
    gateway: null,
    externalId: null,
    paidAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makeRefund(input: {
  id: string;
  orderId: string;
  amount: string;
  reason: string;
  paymentTransactionId?: string | null;
}): RefundRequest {
  return {
    id: input.id,
    tenantId: "tenant_1",
    branchId: "branch_1",
    customerAccountId: "account_1",
    customerId: "customer_1",
    orderId: input.orderId,
    paymentTransactionId: input.paymentTransactionId ?? null,
    amount: input.amount,
    reason: input.reason,
    status: "pending",
    gateway: null,
    externalId: null,
    approvedAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
    refundedAt: null,
    failedReason: null,
    createdAt: now,
    updatedAt: now,
  };
}

function resolveOrderPaymentStatus(order: PaymentOrderRecord) {
  if (compareAmounts(order.paidAmount, "0.00") === 0) {
    return "unpaid";
  }

  return compareAmounts(order.paidAmount, order.totalAmount) >= 0
    ? "paid"
    : "partial";
}

function createRepository(): PaymentRepositoryLike & {
  orders: Map<string, PaymentOrderRecord>;
  transactions: Map<string, CustomerPaymentTransaction>;
  refunds: Map<string, RefundRequest>;
  callbackStatuses: Map<string, "processed" | "rejected" | "failed" | "received">;
} {
  let transactionCount = 0;
  let callbackCount = 0;
  let refundCount = 0;
  const orders = new Map<string, PaymentOrderRecord>([
    [
      "order_1",
      {
        id: "order_1",
        tenantId: "tenant_1",
        branchId: "branch_1",
        customerId: "customer_1",
        customerAccountId: "account_1",
        status: "received",
        paymentStatus: "unpaid",
        totalAmount: "100.00",
        paidAmount: "0.00",
        paidAt: null,
        version: 1,
      },
    ],
  ]);
  const transactions = new Map<string, CustomerPaymentTransaction>();
  const refunds = new Map<string, RefundRequest>();
  const callbackStatuses = new Map<
    string,
    "processed" | "rejected" | "failed" | "received"
  >();

  function callbackKey(input: {
    gateway: string;
    externalId: string;
    event: string;
  }) {
    return `${input.gateway}:${input.externalId}:${input.event}`;
  }

  return {
    orders,
    transactions,
    refunds,
    callbackStatuses,
    async findOwnedOrder({ tenantId, customerAccountId, orderId }) {
      const order = orders.get(orderId);

      if (
        !order ||
        order.tenantId !== tenantId ||
        order.customerAccountId !== customerAccountId
      ) {
        return null;
      }

      return order;
    },
    async findTransactionByIdempotencyKey({ tenantId, idempotencyKey }) {
      return (
        [...transactions.values()].find(
          (transaction) =>
            transaction.tenantId === tenantId &&
            transaction.idempotencyKey === idempotencyKey,
        ) ?? null
      );
    },
    async findOwnedTransaction({ tenantId, customerAccountId, transactionId }) {
      const transaction = transactions.get(transactionId);
      const order = transaction ? orders.get(transaction.orderId) : null;

      if (
        !transaction ||
        !order ||
        transaction.tenantId !== tenantId ||
        order.customerAccountId !== customerAccountId
      ) {
        return null;
      }

      return transaction;
    },
    async findPendingTransactionForOrder({ tenantId, orderId }) {
      return (
        [...transactions.values()].find(
          (transaction) =>
            transaction.tenantId === tenantId &&
            transaction.orderId === orderId &&
            transaction.paymentStatus === "pending",
        ) ?? null
      );
    },
    async findTransactionByExternalId({ gateway: gatewayName, externalId }) {
      return (
        [...transactions.values()].find(
          (transaction) =>
            transaction.gateway === gatewayName &&
            transaction.externalId === externalId,
        ) ?? null
      );
    },
    async createPendingTransaction(input) {
      const existing =
        [...transactions.values()].find(
          (transaction) =>
            transaction.tenantId === input.tenantId &&
            transaction.idempotencyKey === input.idempotencyKey,
        ) ?? null;

      if (existing) {
        return { transaction: existing, idempotent: true };
      }

      transactionCount += 1;
      const transaction = makeTransaction({
        id: `tx_${transactionCount}`,
        orderId: input.orderId,
        amount: input.amount,
        idempotencyKey: input.idempotencyKey,
      });

      transactions.set(transaction.id, transaction);
      return { transaction, idempotent: false };
    },
    async attachGatewayPayment({ transactionId, gateway: gatewayName, externalId }) {
      const transaction = transactions.get(transactionId);

      if (!transaction) {
        throw new Error("transaction missing");
      }

      const updated = {
        ...transaction,
        gateway: gatewayName,
        externalId,
        updatedAt: new Date().toISOString(),
      };

      transactions.set(updated.id, updated);
      return updated;
    },
    async recordCallback(input) {
      const key = callbackKey(input);
      const existingStatus = input.signatureVerified
        ? callbackStatuses.get(key)
        : undefined;

      if (existingStatus) {
        return {
          callback: {
            id: key,
            tenantId: input.tenantId,
            gateway: input.gateway,
            externalId: input.externalId,
            event: input.event,
            signatureVerified: input.signatureVerified,
            processingStatus: existingStatus,
            failureReason: null,
            processedAt: new Date(),
          },
          idempotent: true,
        };
      }

      callbackCount += 1;
      const id = `callback_${callbackCount}`;

      if (input.signatureVerified) {
        callbackStatuses.set(key, "received");
      }
      callbackStatuses.set(id, "received");

      return {
        callback: {
          id,
          tenantId: input.tenantId,
          gateway: input.gateway,
          externalId: input.externalId,
          event: input.event,
          signatureVerified: input.signatureVerified,
          processingStatus: "received",
          failureReason: null,
          processedAt: null,
        },
        idempotent: false,
      };
    },
    async markCallback({ callbackId, status }) {
      callbackStatuses.set(callbackId, status);

      for (const [key, value] of callbackStatuses.entries()) {
        if (value === "received" && key.startsWith("mock:")) {
          callbackStatuses.set(key, status);
        }
      }
    },
    async reconcilePaymentCallback({ callbackId, verification }) {
      const transaction =
        (verification.transactionId
          ? transactions.get(verification.transactionId)
          : null) ??
        [...transactions.values()].find(
          (item) =>
            item.gateway === verification.gateway &&
            item.externalId === verification.externalId,
        ) ??
        null;

      if (!transaction) {
        await this.markCallback({ callbackId, status: "failed" });
        return null;
      }

      if (
        transaction.externalId !== verification.externalId ||
        compareAmounts(transaction.amount, verification.amount) !== 0
      ) {
        await this.markCallback({ callbackId, status: "failed" });
        return null;
      }

      if (
        transaction.paymentStatus === "paid" &&
        verification.status !== "refunded"
      ) {
        await this.markCallback({ callbackId, status: "processed" });
        return transaction;
      }

      const updated = {
        ...transaction,
        paymentStatus: verification.status,
        paidAt:
          verification.status === "paid"
            ? verification.occurredAt.toISOString()
            : transaction.paidAt,
      };

      transactions.set(updated.id, updated);

      if (verification.status === "paid") {
        const order = orders.get(updated.orderId);

        if (order) {
          order.paidAmount = addAmounts(order.paidAmount, updated.amount);
          order.paymentStatus = resolveOrderPaymentStatus(order);
          order.status = order.paymentStatus === "paid" ? "paid" : order.status;
          order.paidAt = verification.occurredAt;
        }
      }

      await this.markCallback({ callbackId, status: "processed" });
      return updated;
    },
    async createRefundRequest(input) {
      refundCount += 1;
      const refund = makeRefund({
        id: `refund_${refundCount}`,
        orderId: input.orderId,
        amount: input.amount,
        reason: input.reason,
        paymentTransactionId: input.paymentTransactionId,
      });

      refunds.set(refund.id, refund);
      return refund;
    },
    async listRefundRequests({ tenantId, customerAccountId, branchIds, status }) {
      return [...refunds.values()].filter(
        (refund) =>
          refund.tenantId === tenantId &&
          (!customerAccountId || refund.customerAccountId === customerAccountId) &&
          (!branchIds || branchIds.length === 0 || branchIds.includes(refund.branchId)) &&
          (!status || refund.status === status),
      );
    },
    async sumOpenRefundRequests({ tenantId, orderId, excludeRefundRequestId }) {
      return [...refunds.values()]
        .filter(
          (refund) =>
            refund.tenantId === tenantId &&
            refund.orderId === orderId &&
            refund.id !== excludeRefundRequestId &&
            (refund.status === "pending" || refund.status === "processing"),
        )
        .reduce((total, refund) => addAmounts(total, refund.amount), "0.00");
    },
    async findRefundRequest({ tenantId, refundRequestId }) {
      const refund = refunds.get(refundRequestId);

      return refund?.tenantId === tenantId ? refund : null;
    },
    async startRefundProcessing({ tenantId, refundRequestId, operatorUserId }) {
      const refund = refunds.get(refundRequestId);

      if (!refund || refund.tenantId !== tenantId || refund.status !== "pending") {
        return null;
      }

      const updated = {
        ...refund,
        status: "processing" as const,
        approvedAt: new Date().toISOString(),
        approvedBy: operatorUserId,
        updatedAt: new Date().toISOString(),
      };

      refunds.set(updated.id, updated);
      return updated;
    },
    async attachRefundGateway({ tenantId, refundRequestId, gateway: gatewayName, externalId }) {
      const refund = refunds.get(refundRequestId);

      if (!refund || refund.tenantId !== tenantId || refund.status !== "processing") {
        return null;
      }

      const updated = {
        ...refund,
        gateway: gatewayName,
        externalId,
        updatedAt: new Date().toISOString(),
      };

      refunds.set(updated.id, updated);
      return updated;
    },
    async rejectRefundRequest({ tenantId, refundRequestId, operatorUserId, reason }) {
      const refund = refunds.get(refundRequestId);

      if (!refund || refund.tenantId !== tenantId || refund.status !== "pending") {
        return null;
      }

      const updated = {
        ...refund,
        status: "rejected" as const,
        rejectedAt: new Date().toISOString(),
        rejectedBy: operatorUserId,
        rejectionReason: reason,
        updatedAt: new Date().toISOString(),
      };

      refunds.set(updated.id, updated);
      return updated;
    },
    async reconcileRefundCallback({ callbackId, verification }) {
      const refund =
        (verification.refundRequestId
          ? refunds.get(verification.refundRequestId)
          : null) ??
        [...refunds.values()].find(
          (item) =>
            item.gateway === verification.gateway &&
            item.externalId === verification.externalId,
        ) ??
        null;

      if (!refund) {
        await this.markCallback({ callbackId, status: "failed" });
        return null;
      }

      if (
        refund.externalId !== verification.externalId ||
        compareAmounts(refund.amount, verification.amount) !== 0
      ) {
        await this.markCallback({ callbackId, status: "failed" });
        return null;
      }

      const updated = {
        ...refund,
        status:
          verification.status === "refunded"
            ? ("refunded" as const)
            : ("failed" as const),
        refundedAt:
          verification.status === "refunded"
            ? verification.occurredAt.toISOString()
            : null,
        failedReason:
          verification.status === "refunded"
            ? null
            : verification.failureReason ?? "Refund failed.",
        updatedAt: new Date().toISOString(),
      };

      refunds.set(updated.id, updated);

      if (updated.status === "refunded") {
        const order = orders.get(updated.orderId);

        if (order) {
          order.paidAmount = subtractAmounts(order.paidAmount, updated.amount);
          order.paymentStatus = resolveOrderPaymentStatus(order);
          order.status = order.paymentStatus === "paid" ? "paid" : "received";
        }
      }

      await this.markCallback({ callbackId, status: "processed" });
      return updated;
    },
    async sumPaidTransactions({ tenantId, orderId }) {
      return [...transactions.values()]
        .filter(
          (transaction) =>
            transaction.tenantId === tenantId &&
            transaction.orderId === orderId &&
            transaction.paymentStatus === "paid",
        )
        .reduce((total, transaction) => addAmounts(total, transaction.amount), "0.00");
    },
    async listPaidTransactionsForOrder({ tenantId, orderId }) {
      return [...transactions.values()].filter(
        (transaction) =>
          transaction.tenantId === tenantId &&
          transaction.orderId === orderId &&
          transaction.paymentStatus === "paid",
      );
    },
  };
}

function createNotificationPublisher(): {
  events: NotificationEvent[];
  publish(event: NotificationEvent): Promise<NotificationPublishResult>;
} {
  const events: NotificationEvent[] = [];

  return {
    events,
    async publish(event) {
      events.push(event);
      return {
        matched: 1,
        enqueued: 1,
        skipped: 0,
        idempotent: 0,
      };
    },
  };
}

async function sendSignedCallback(
  service: PaymentService,
  input: Parameters<MockPaymentGateway["createSignedCallbackPayload"]>[0],
) {
  const signed = gateway.createSignedCallbackPayload(input);

  return service.handleWebhook({
    gateway: "mock",
    payload: signed.payload,
    headers: signed.headers,
  });
}

export async function runPaymentSmokeChecks(): Promise<void> {
  const repository = createRepository();
  const notificationPublisher = createNotificationPublisher();
  const service = new PaymentService({
    repository,
    gateway,
    config: {
      gateway: "mock",
      currency: "XOF",
      mockSecret,
      mockPaymentBaseUrl: "http://localhost:3002",
    },
    notificationPublisher,
  });

  const first = await service.createPayment({
    authContext: customerContext,
    orderId: "order_1",
    amount: "40.00",
    idempotencyKey: "pay_40",
  });

  assert(first.transaction.id === "tx_1", "payment should create tx_1");
  assert(first.gateway.externalId === "mock_pay_tx_1", "mock external id should be stable");
  assert(!first.idempotent, "first payment should not be idempotent");

  const replay = await service.createPayment({
    authContext: customerContext,
    orderId: "order_1",
    amount: "40.00",
    idempotencyKey: "pay_40",
  });

  assert(replay.idempotent, "same idempotency key should replay");
  assert(repository.transactions.size === 1, "replay must not insert a transaction");

  await assertRejectsPayment(
    () =>
      service.createPayment({
        authContext: customerContext,
        orderId: "order_1",
        amount: "50.00",
        idempotencyKey: "pay_40",
      }),
    409,
  );

  await assertRejectsPayment(
    () =>
      service.createPayment({
        authContext: customerContext,
        orderId: "order_1",
        amount: "20.00",
        idempotencyKey: "pay_parallel",
      }),
    409,
  );

  await assertRejectsPayment(
    () =>
      service.createPayment({
        authContext: otherCustomerContext,
        orderId: "order_1",
        amount: "10.00",
        idempotencyKey: "pay_forbidden",
      }),
    404,
  );

  await assertRejectsPayment(
    () =>
      service.createPayment({
        authContext: customerContext,
        orderId: "order_1",
        amount: "120.00",
        idempotencyKey: "pay_over",
      }),
    422,
  );

  const firstPaid = await sendSignedCallback(service, {
    action: "pay",
    tenantId: "tenant_1",
    externalId: first.gateway.externalId,
    event: "payment.succeeded.tx_1",
    status: "paid",
    amount: "40.00",
    transactionId: first.transaction.id,
  });

  assert(firstPaid.accepted, "first callback should be accepted");
  assert(
    repository.orders.get("order_1")?.paymentStatus === "partial",
    "first paid callback should partially pay the order",
  );
  assert(
    repository.orders.get("order_1")?.paidAmount === "40.00",
    "first paid callback should add 40.00",
  );
  assert(
    notificationPublisher.events[0]?.idempotencyKey === "payment.paid:tx_1",
    "payment success should publish a notification event",
  );

  const duplicatePaid = await sendSignedCallback(service, {
    action: "pay",
    tenantId: "tenant_1",
    externalId: first.gateway.externalId,
    event: "payment.succeeded.tx_1",
    status: "paid",
    amount: "40.00",
    transactionId: first.transaction.id,
  });

  assert(duplicatePaid.idempotent, "duplicate callback should be idempotent");
  assert(
    repository.orders.get("order_1")?.paidAmount === "40.00",
    "duplicate callback must not add money again",
  );

  await sendSignedCallback(service, {
    action: "pay",
    tenantId: "tenant_1",
    externalId: first.gateway.externalId,
    event: "payment.amount-mismatch.tx_1",
    status: "paid",
    amount: "1.00",
    transactionId: first.transaction.id,
  });

  assert(
    repository.orders.get("order_1")?.paidAmount === "40.00",
    "amount-mismatched callback must not update the order",
  );

  await sendSignedCallback(service, {
    action: "pay",
    tenantId: "tenant_1",
    externalId: "mock_pay_wrong",
    event: "payment.external-mismatch.tx_1",
    status: "paid",
    amount: "40.00",
    transactionId: first.transaction.id,
  });

  assert(
    repository.orders.get("order_1")?.paidAmount === "40.00",
    "external-id-mismatched callback must not update the order",
  );

  await service.handleWebhook({
    gateway: "mock",
    payload: {
      gateway: "mock",
      action: "pay",
      tenantId: "tenant_1",
      externalId: first.gateway.externalId,
      event: "payment.retry.tx_1",
      status: "paid",
      amount: "10.00",
      transactionId: first.transaction.id,
      occurredAt: new Date().toISOString(),
    },
    headers: { "x-cleanhub-mock-signature": "bad" },
  });

  assert(
    repository.orders.get("order_1")?.paidAmount === "40.00",
    "invalid callback must not update the order",
  );

  const validRetryAfterInvalidSignature = await sendSignedCallback(service, {
    action: "pay",
    tenantId: "tenant_1",
    externalId: first.gateway.externalId,
    event: "payment.retry.tx_1",
    status: "paid",
    amount: "40.00",
    transactionId: first.transaction.id,
  });

  assert(
    validRetryAfterInvalidSignature.accepted &&
      !validRetryAfterInvalidSignature.idempotent,
    "valid retry after invalid signature should still be processed",
  );

  const second = await service.createPayment({
    authContext: customerContext,
    orderId: "order_1",
    amount: "60.00",
    idempotencyKey: "pay_60",
  });
  await sendSignedCallback(service, {
    action: "pay",
    tenantId: "tenant_1",
    externalId: second.gateway.externalId,
    event: "payment.succeeded.tx_2",
    status: "paid",
    amount: "60.00",
    transactionId: second.transaction.id,
  });

  assert(
    repository.orders.get("order_1")?.paymentStatus === "paid",
    "cumulative payments should fully pay the order",
  );
  assert(
    repository.orders.get("order_1")?.paidAmount === "100.00",
    "cumulative payments should total 100.00",
  );

  await assertRejectsPayment(
    () =>
      service.createRefundRequest({
        authContext: customerContext,
        orderId: "order_1",
        amount: "150.00",
        reason: "Too much",
      }),
    422,
  );

  const refund = await service.createRefundRequest({
    authContext: customerContext,
    orderId: "order_1",
    amount: "30.00",
    reason: "Customer request",
  });

  assert(refund.status === "pending", "refund request should start pending");

  await assertRejectsPayment(
    () =>
      service.createRefundRequest({
        authContext: customerContext,
        orderId: "order_1",
        amount: "80.00",
        reason: "Already reserved",
      }),
    422,
  );

  await assertRejectsPayment(
    () =>
      service.approveRefundRequest({
        authContext: restrictedOwnerContext,
        refundRequestId: refund.id,
      }),
    403,
  );

  const approval = await service.approveRefundRequest({
    authContext: ownerContext,
    refundRequestId: refund.id,
  });

  assert(
    approval.refundRequest.status === "processing",
    "approved refund should wait for callback",
  );

  await assertRejectsPayment(
    () =>
      service.approveRefundRequest({
        authContext: ownerContext,
        refundRequestId: refund.id,
      }),
    409,
  );

  await sendSignedCallback(service, {
    action: "refund",
    tenantId: "tenant_1",
    externalId: approval.gateway?.externalId ?? "",
    event: "refund.amount-mismatch.refund_1",
    status: "refunded",
    amount: "1.00",
    transactionId: second.transaction.id,
    refundRequestId: refund.id,
  });

  assert(
    repository.orders.get("order_1")?.paidAmount === "100.00",
    "amount-mismatched refund callback must not update the order",
  );

  await sendSignedCallback(service, {
    action: "refund",
    tenantId: "tenant_1",
    externalId: approval.gateway?.externalId ?? "",
    event: "refund.succeeded.refund_1",
    status: "refunded",
    amount: "30.00",
    transactionId: second.transaction.id,
    refundRequestId: refund.id,
  });

  assert(
    repository.refunds.get(refund.id)?.status === "refunded",
    "refund callback should mark request refunded",
  );
  assert(
    repository.orders.get("order_1")?.paidAmount === "70.00",
    "refund callback should reduce paid amount",
  );

  const rejectedRefund = await service.createRefundRequest({
    authContext: customerContext,
    orderId: "order_1",
    amount: "10.00",
    reason: "Rejected path",
  });
  const rejected = await service.rejectRefundRequest({
    authContext: ownerContext,
    refundRequestId: rejectedRefund.id,
    reason: "Outside policy",
  });

  assert(rejected.status === "rejected", "owner should reject pending refund");
}

if (process.argv[1]?.endsWith("payment.smoke.ts")) {
  await runPaymentSmokeChecks();
}
