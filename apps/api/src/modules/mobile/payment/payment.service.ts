import { getDb, type Database } from "@cleanhub/db";
import { createLogger, type AppLogger } from "@cleanhub/logger";

import {
  refundApprovedEvent,
  refundRejectedEvent,
  type NotificationPublisher,
} from "../../notifications/index.js";
import type { MobileAuthContext } from "../auth/auth.types.js";
import { MockPaymentGateway } from "./mock-payment.gateway.js";
import {
  amountToCents,
  compareAmounts,
  isPositiveAmount,
  subtractAmounts,
} from "./payment-money.js";
import { getCurrencyPayableStep } from "@cleanhub/domain/currency";
import { loadPaymentConfig } from "./payment.config.js";
import {
  PaymentRepository,
  type PaymentOrderRecord,
} from "./payment.repository.js";
import type {
  ApproveRefundRequestInput,
  CreatePaymentInput,
  CreateRefundRequestInput,
  CustomerPaymentContext,
  GetPaymentStatusInput,
  ListRefundRequestsInput,
  OwnerPaymentContext,
  PaymentConfig,
  PaymentError,
  PaymentGateway,
  PaymentGatewayName,
  PaymentInitiationResult,
  PaymentStatusResult,
  PaymentWebhookInput,
  PaymentWebhookResult,
  RefundOrderDetail,
  RefundRequest,
  RefundApprovalResult,
  RejectRefundRequestInput,
  SimulateMockPaymentInput,
} from "./payment.types.js";
import { PaymentError as MobilePaymentError } from "./payment.types.js";

export type PaymentRepositoryLike = Pick<
  PaymentRepository,
  | "findOwnedOrder"
  | "findTransactionByIdempotencyKey"
  | "findOwnedTransaction"
  | "findPendingTransactionForOrder"
  | "findTransactionByExternalId"
  | "createPendingTransaction"
  | "attachGatewayPayment"
  | "recordCallback"
  | "markCallback"
  | "reconcilePaymentCallback"
  | "createRefundRequest"
  | "listRefundRequests"
  | "sumOpenRefundRequests"
  | "findRefundRequest"
  | "getRefundOrderDetail"
  | "startRefundProcessing"
  | "releaseRefundProcessing"
  | "attachRefundGateway"
  | "rejectRefundRequest"
  | "reconcileRefundCallback"
  | "sumPaidTransactions"
  | "listPaidTransactionsForOrder"
>;

export type PaymentServiceOptions = {
  db?: Database;
  repository?: PaymentRepositoryLike;
  gateway?: PaymentGateway;
  config?: PaymentConfig;
  notificationPublisher?: NotificationPublisher;
  logger?: Pick<AppLogger, "info" | "warn" | "error">;
};

function forbidden(): PaymentError {
  return new MobilePaymentError(
    "PAYMENT_FORBIDDEN",
    "Payment access is required.",
    403,
  );
}

function validationError(
  message: string,
  details?: Record<string, unknown>,
): PaymentError {
  return new MobilePaymentError(
    "PAYMENT_VALIDATION_ERROR",
    message,
    422,
    details,
  );
}

/**
 * Reject an amount the customer could not actually tender in this currency.
 *
 * Money is stored in hundredths whatever the currency, so nothing in the
 * schema stops a request for 50.25 XOF -- an amount with no coin behind it,
 * since the franc CFA has no minor unit. The POS path enforces this through
 * `assertCashTendersArePayable`; mobile validated only that the string had at
 * most two decimals, so it would hand the gateway an amount that cannot
 * settle.
 */
function assertAmountIsPayable(
  amount: string,
  currency: string | null | undefined,
): void {
  const payableStep = getCurrencyPayableStep(currency);

  if (payableStep <= BigInt(1)) return;

  if (amountToCents(amount) % payableStep !== BigInt(0)) {
    throw validationError(
      `An amount of ${amount} cannot be paid in ${currency}.`,
      { amount, currency },
    );
  }
}

function conflict(
  message: string,
  details?: Record<string, unknown>,
): PaymentError {
  return new MobilePaymentError("PAYMENT_CONFLICT", message, 409, details);
}

function orderNotFound(): PaymentError {
  return new MobilePaymentError(
    "PAYMENT_ORDER_NOT_FOUND",
    "Order was not found.",
    404,
  );
}

function transactionNotFound(): PaymentError {
  return new MobilePaymentError(
    "PAYMENT_TRANSACTION_NOT_FOUND",
    "Payment transaction was not found.",
    404,
  );
}

function refundNotFound(): PaymentError {
  return new MobilePaymentError(
    "PAYMENT_REFUND_NOT_FOUND",
    "Refund request was not found.",
    404,
  );
}

function assertCustomerContext(
  authContext: MobileAuthContext,
): CustomerPaymentContext {
  if (
    authContext.subjectType !== "customer" ||
    authContext.role !== "customer"
  ) {
    throw forbidden();
  }

  return authContext as CustomerPaymentContext;
}

function assertOwnerContext(
  authContext: MobileAuthContext,
): OwnerPaymentContext {
  if (authContext.subjectType !== "staff" || authContext.role !== "owner") {
    throw forbidden();
  }

  return authContext as OwnerPaymentContext;
}

function assertBranchAccess(
  authContext: OwnerPaymentContext,
  branchId: string,
): void {
  if (
    authContext.branchIds.length > 0 &&
    !authContext.branchIds.includes(branchId)
  ) {
    throw forbidden();
  }
}

function calculateBalance(
  order: Pick<PaymentOrderRecord, "totalAmount" | "paidAmount">,
): string {
  const balance = subtractAmounts(order.totalAmount, order.paidAmount);

  return compareAmounts(balance, "0.00") < 0 ? "0.00" : balance;
}

function calculateRefundableAmount(input: {
  paidAmount: string;
  openRefundAmount: string;
}): string {
  const refundable = subtractAmounts(input.paidAmount, input.openRefundAmount);

  return compareAmounts(refundable, "0.00") < 0 ? "0.00" : refundable;
}

function getGatewayForConfig(
  config: PaymentConfig,
  gateway?: PaymentGateway,
): PaymentGateway {
  if (gateway) {
    return gateway;
  }

  return new MockPaymentGateway({
    secret: config.mockSecret,
    paymentBaseUrl: config.mockPaymentBaseUrl,
  });
}

export class PaymentService {
  private readonly repository: PaymentRepositoryLike;
  private readonly gateway: PaymentGateway;
  private readonly config: PaymentConfig;
  private readonly notificationPublisher?: NotificationPublisher;
  private readonly logger: Pick<AppLogger, "info" | "warn" | "error">;

  constructor(options: PaymentServiceOptions = {}) {
    const config = options.config ?? loadPaymentConfig();

    this.config = config;
    this.repository =
      options.repository ?? new PaymentRepository(options.db ?? getDb());
    this.gateway = getGatewayForConfig(config, options.gateway);
    this.notificationPublisher = options.notificationPublisher;
    this.logger =
      options.logger ??
      createLogger({ name: "payment", service: "cleanhub-api" });
  }

  async createPayment(
    input: CreatePaymentInput,
  ): Promise<PaymentInitiationResult> {
    const customer = assertCustomerContext(input.authContext);

    if (!isPositiveAmount(input.amount)) {
      throw validationError("Payment amount must be greater than zero.");
    }

    const order = await this.repository.findOwnedOrder({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      orderId: input.orderId,
    });

    if (!order) {
      throw orderNotFound();
    }

    const existing = await this.repository.findTransactionByIdempotencyKey({
      tenantId: customer.tenantId,
      idempotencyKey: input.idempotencyKey,
    });

    if (existing) {
      if (
        existing.orderId !== order.id ||
        existing.customerId !== order.customerId ||
        compareAmounts(existing.amount, input.amount) !== 0
      ) {
        throw conflict("Idempotency key is already used for another payment.", {
          idempotencyKey: input.idempotencyKey,
        });
      }

      if (existing.gateway && existing.externalId) {
        return {
          transaction: existing,
          gateway: await this.gateway.createPayment({
            tenantId: existing.tenantId,
            orderId: existing.orderId,
            transactionId: existing.id,
            amount: existing.amount,
            currency: existing.currency,
            idempotencyKey: input.idempotencyKey,
            customerAccountId: customer.subjectId,
          }),
          idempotent: true,
        };
      }
    }

    if (order.paymentStatus === "paid" || order.paymentStatus === "refunded") {
      throw conflict("Order is not payable in its current payment state.", {
        paymentStatus: order.paymentStatus,
      });
    }

    assertAmountIsPayable(input.amount, order.currency);

    const balance = calculateBalance(order);

    if (compareAmounts(input.amount, balance) > 0) {
      throw validationError("Payment amount exceeds the order balance.", {
        requestedAmount: input.amount,
        balance,
      });
    }

    const pending = await this.repository.findPendingTransactionForOrder({
      tenantId: customer.tenantId,
      orderId: order.id,
    });

    if (pending && pending.idempotencyKey !== input.idempotencyKey) {
      throw conflict("Order already has a pending app payment.", {
        transactionId: pending.id,
      });
    }

    const { transaction, idempotent } =
      await this.repository.createPendingTransaction({
        tenantId: customer.tenantId,
        branchId: order.branchId,
        customerId: order.customerId,
        orderId: order.id,
        amount: input.amount,
        currency: order.currency,
        idempotencyKey: input.idempotencyKey,
      });
    const gateway = await this.gateway.createPayment({
      tenantId: customer.tenantId,
      orderId: order.id,
      transactionId: transaction.id,
      amount: transaction.amount,
      currency: transaction.currency,
      idempotencyKey: input.idempotencyKey,
      customerAccountId: customer.subjectId,
    });
    const attached =
      transaction.gateway && transaction.externalId
        ? transaction
        : await this.repository.attachGatewayPayment({
            tenantId: customer.tenantId,
            transactionId: transaction.id,
            gateway: gateway.gateway,
            externalId: gateway.externalId,
          });

    this.logger.info(
      {
        tenantId: customer.tenantId,
        orderId: order.id,
        transactionId: attached.id,
        gateway: gateway.gateway,
        idempotent,
      },
      "Mobile customer payment initiated",
    );

    return {
      transaction: attached,
      gateway,
      idempotent,
    };
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput,
  ): Promise<PaymentStatusResult> {
    const customer = assertCustomerContext(input.authContext);
    const transaction = await this.repository.findOwnedTransaction({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      transactionId: input.paymentId,
    });

    if (!transaction) {
      throw transactionNotFound();
    }

    return { transaction };
  }

  async simulateMockPayment(
    input: SimulateMockPaymentInput,
  ): Promise<PaymentWebhookResult> {
    // Defence in depth. The customer-facing route for this was removed --
    // staff collect payment at the counter -- but the method survives for
    // tests and local development, so it must refuse to run in production
    // rather than rely on nothing calling it. The gateway check alone is not
    // enough: `readGateway` returns "mock" on every branch today, so
    // `instanceof MockPaymentGateway` is always true.
    if (process.env.NODE_ENV === "production") {
      throw new MobilePaymentError(
        "PAYMENT_GATEWAY_UNAVAILABLE",
        "Mock payment simulation is not available.",
        502,
      );
    }

    if (!(this.gateway instanceof MockPaymentGateway)) {
      throw new MobilePaymentError(
        "PAYMENT_GATEWAY_UNAVAILABLE",
        "Mock payment simulation is not available.",
        502,
      );
    }

    const customer = assertCustomerContext(input.authContext);
    const transaction = await this.repository.findOwnedTransaction({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      transactionId: input.paymentId,
    });

    if (!transaction) {
      throw transactionNotFound();
    }

    if (!transaction.externalId) {
      throw conflict("Payment has not been attached to the gateway.");
    }

    const callback = this.gateway.createSignedCallbackPayload({
      action: "pay",
      tenantId: transaction.tenantId,
      externalId: transaction.externalId,
      event: `mock.payment.${input.status}.${transaction.id}`,
      status: input.status,
      amount: transaction.amount,
      transactionId: transaction.id,
    });

    return this.handleWebhook({
      gateway: "mock",
      payload: callback.payload,
      headers: callback.headers,
    });
  }

  async handleWebhook(
    input: PaymentWebhookInput,
  ): Promise<PaymentWebhookResult> {
    const gateway = this.assertGateway(input.gateway);
    const verification = await gateway.verifyCallback({
      payload: input.payload,
      headers: input.headers,
    });
    const callback = await this.repository.recordCallback({
      tenantId: verification.tenantId || null,
      gateway: verification.gateway,
      externalId: verification.externalId,
      event: verification.event,
      signatureVerified: verification.ok,
      rawPayload: input.payload,
    });

    if (callback.idempotent) {
      return {
        accepted: callback.callback.processingStatus === "processed",
        idempotent: true,
        callbackId: callback.callback.id,
        status:
          callback.callback.processingStatus === "processed"
            ? "processed"
            : callback.callback.processingStatus === "rejected"
              ? "rejected"
              : "failed",
      };
    }

    if (!verification.ok) {
      await this.repository.markCallback({
        tenantId: callback.callback.tenantId,
        callbackId: callback.callback.id,
        status: "rejected",
        failureReason: verification.failureReason,
      });
      this.logger.warn(
        {
          gateway: verification.gateway,
          externalId: verification.externalId,
          event: verification.event,
        },
        "Payment callback rejected",
      );
      return {
        accepted: false,
        idempotent: false,
        callbackId: callback.callback.id,
        status: "rejected",
      };
    }

    if (verification.action === "refund") {
      await this.repository.reconcileRefundCallback({
        callbackId: callback.callback.id,
        verification,
      });
    } else {
      await this.repository.reconcilePaymentCallback({
        callbackId: callback.callback.id,
        verification,
      });
      await this.publishPaymentNotification(verification);
    }

    return {
      accepted: true,
      idempotent: false,
      callbackId: callback.callback.id,
      status: "processed",
    };
  }

  async createRefundRequest(
    input: CreateRefundRequestInput,
  ): Promise<RefundRequest> {
    const customer = assertCustomerContext(input.authContext);

    if (!isPositiveAmount(input.amount)) {
      throw validationError("Refund amount must be greater than zero.");
    }

    const order = await this.repository.findOwnedOrder({
      tenantId: customer.tenantId,
      customerAccountId: customer.subjectId,
      orderId: input.orderId,
    });

    if (!order) {
      throw orderNotFound();
    }

    assertAmountIsPayable(input.amount, order.currency);

    const openRefundAmount = await this.repository.sumOpenRefundRequests({
      tenantId: customer.tenantId,
      orderId: order.id,
    });
    const refundableAmount = calculateRefundableAmount({
      paidAmount: order.paidAmount,
      openRefundAmount,
    });

    if (compareAmounts(input.amount, refundableAmount) > 0) {
      throw validationError("Refund amount exceeds the refundable balance.", {
        requestedAmount: input.amount,
        refundableAmount,
      });
    }

    const paidTransactions = await this.repository.listPaidTransactionsForOrder(
      {
        tenantId: customer.tenantId,
        orderId: order.id,
      },
    );
    const paymentTransaction = paidTransactions[0] ?? null;

    const refundRequest = await this.repository.createRefundRequest({
      tenantId: customer.tenantId,
      branchId: order.branchId,
      customerAccountId: customer.subjectId,
      customerId: order.customerId,
      orderId: order.id,
      amount: input.amount,
      currency: order.currency,
      reason: input.reason,
      paymentTransactionId: paymentTransaction?.id ?? null,
    });

    if (!refundRequest) {
      throw conflict(
        "An active refund request already exists for this order.",
        {
          orderId: order.id,
        },
      );
    }

    return refundRequest;
  }

  async listRefundRequests(
    input: ListRefundRequestsInput,
  ): Promise<RefundRequest[]> {
    if (input.authContext.subjectType === "customer") {
      const customer = assertCustomerContext(input.authContext);

      return this.repository.listRefundRequests({
        tenantId: customer.tenantId,
        customerAccountId: customer.subjectId,
        status: input.status,
      });
    }

    const owner = assertOwnerContext(input.authContext);

    return this.repository.listRefundRequests({
      tenantId: owner.tenantId,
      branchIds: owner.branchIds,
      status: input.status,
    });
  }

  async getRefundOrderDetail(
    authContext: MobileAuthContext,
    refundRequestId: string,
  ): Promise<RefundOrderDetail> {
    const owner = assertOwnerContext(authContext);
    const refundRequest = await this.repository.findRefundRequest({
      tenantId: owner.tenantId,
      refundRequestId,
    });

    if (!refundRequest) {
      throw refundNotFound();
    }

    assertBranchAccess(owner, refundRequest.branchId);
    const order = await this.repository.getRefundOrderDetail({
      tenantId: owner.tenantId,
      orderId: refundRequest.orderId,
    });

    if (!order) {
      throw orderNotFound();
    }

    return order;
  }

  async approveRefundRequest(
    input: ApproveRefundRequestInput,
  ): Promise<RefundApprovalResult> {
    const owner = assertOwnerContext(input.authContext);
    const refundRequest = await this.repository.findRefundRequest({
      tenantId: owner.tenantId,
      refundRequestId: input.refundRequestId,
    });

    if (!refundRequest) {
      throw refundNotFound();
    }

    assertBranchAccess(owner, refundRequest.branchId);

    if (refundRequest.status !== "pending") {
      throw conflict("Only pending refund requests can be approved.", {
        currentStatus: refundRequest.status,
      });
    }

    const order = await this.repository.findOwnedOrder({
      tenantId: owner.tenantId,
      customerAccountId: refundRequest.customerAccountId,
      orderId: refundRequest.orderId,
    });

    if (!order) {
      throw orderNotFound();
    }

    const openRefundAmount = await this.repository.sumOpenRefundRequests({
      tenantId: owner.tenantId,
      orderId: order.id,
      excludeRefundRequestId: refundRequest.id,
    });
    const refundableAmount = calculateRefundableAmount({
      paidAmount: order.paidAmount,
      openRefundAmount,
    });

    if (compareAmounts(refundRequest.amount, refundableAmount) > 0) {
      throw validationError("Refund amount exceeds the current paid amount.", {
        requestedAmount: refundRequest.amount,
        refundableAmount,
      });
    }

    const paymentTransactionId = refundRequest.paymentTransactionId;

    if (!paymentTransactionId) {
      throw validationError(
        "Refund request is not linked to a paid transaction.",
      );
    }

    const processing = await this.repository.startRefundProcessing({
      tenantId: owner.tenantId,
      refundRequestId: refundRequest.id,
      operatorUserId: owner.subjectId,
    });

    if (!processing) {
      throw conflict("Refund request changed while approving.");
    }

    // The row is `processing` from here, which is what the partial unique
    // index uses to keep a second operator out. If the gateway never accepts
    // the refund, that claim has to be given back: leaving it set would strand
    // the request in a status neither approve nor reject can act on, and the
    // index would block the customer from ever asking again.
    let gateway: Awaited<ReturnType<PaymentGateway["createRefund"]>>;

    try {
      gateway = await this.gateway.createRefund({
        tenantId: owner.tenantId,
        refundRequestId: refundRequest.id,
        transactionId: paymentTransactionId,
        amount: refundRequest.amount,
        currency: refundRequest.currency,
      });
    } catch (error) {
      const released = await this.repository
        .releaseRefundProcessing({
          tenantId: owner.tenantId,
          refundRequestId: refundRequest.id,
        })
        .catch((releaseError: unknown) => {
          this.logger.error(
            {
              tenantId: owner.tenantId,
              refundRequestId: refundRequest.id,
              err: releaseError,
            },
            "Failed to release a refund request after a gateway error",
          );
          return null;
        });

      this.logger.error(
        {
          tenantId: owner.tenantId,
          refundRequestId: refundRequest.id,
          operatorUserId: owner.subjectId,
          released: Boolean(released),
          err: error,
        },
        "Mobile refund gateway rejected the refund",
      );

      throw error;
    }
    const approved = await this.repository.attachRefundGateway({
      tenantId: owner.tenantId,
      refundRequestId: refundRequest.id,
      gateway: gateway.gateway,
      externalId: gateway.externalId,
    });

    if (!approved) {
      throw conflict("Refund request changed after gateway refund creation.");
    }

    this.logger.info(
      {
        tenantId: owner.tenantId,
        refundRequestId: approved.id,
        gateway: gateway.gateway,
        operatorUserId: owner.subjectId,
      },
      "Mobile refund request approved",
    );

    let completed = approved;

    if (this.gateway instanceof MockPaymentGateway) {
      const callback = this.gateway.createSignedCallbackPayload({
        action: "refund",
        tenantId: approved.tenantId,
        externalId: gateway.externalId,
        event: `mock.refund.refunded.${approved.id}`,
        status: "refunded",
        amount: approved.amount,
        transactionId: paymentTransactionId,
        refundRequestId: approved.id,
      });

      await this.handleWebhook({
        gateway: "mock",
        payload: callback.payload,
        headers: callback.headers,
      });
      completed =
        (await this.repository.findRefundRequest({
          tenantId: owner.tenantId,
          refundRequestId: approved.id,
        })) ?? approved;
    }

    await this.publishRefundApproved(completed);

    return {
      refundRequest: completed,
      gateway,
    };
  }

  async rejectRefundRequest(
    input: RejectRefundRequestInput,
  ): Promise<RefundRequest> {
    const owner = assertOwnerContext(input.authContext);
    const refundRequest = await this.repository.findRefundRequest({
      tenantId: owner.tenantId,
      refundRequestId: input.refundRequestId,
    });

    if (!refundRequest) {
      throw refundNotFound();
    }

    assertBranchAccess(owner, refundRequest.branchId);

    if (refundRequest.status !== "pending") {
      throw conflict("Only pending refund requests can be rejected.", {
        currentStatus: refundRequest.status,
      });
    }

    const rejected = await this.repository.rejectRefundRequest({
      tenantId: owner.tenantId,
      refundRequestId: refundRequest.id,
      operatorUserId: owner.subjectId,
      reason: input.reason,
    });

    if (!rejected) {
      throw conflict("Refund request changed while rejecting.");
    }

    await this.publishRefundRejected(rejected);

    return rejected;
  }

  private assertGateway(gatewayName: PaymentGatewayName): PaymentGateway {
    if (gatewayName !== this.gateway.name) {
      throw new MobilePaymentError(
        "PAYMENT_GATEWAY_UNAVAILABLE",
        "Payment gateway is not configured.",
        502,
        { gateway: gatewayName },
      );
    }

    return this.gateway;
  }

  private async publishPaymentNotification(verification: {
    status: string;
    tenantId: string;
    externalId: string;
    transactionId?: string;
    amount: string;
  }): Promise<void> {
    if (!this.notificationPublisher || verification.status !== "paid") {
      return;
    }

    const transaction = await this.repository.findTransactionByExternalId({
      tenantId: verification.tenantId,
      gateway: this.gateway.name,
      externalId: verification.externalId,
    });

    if (!transaction) {
      return;
    }

    try {
      await this.notificationPublisher.publish({
        name: "order.completed",
        tenantId: transaction.tenantId,
        branchId: transaction.branchId,
        customerId: transaction.customerId,
        relatedType: "order",
        relatedId: transaction.orderId,
        idempotencyKey: `payment.paid:${transaction.id}`,
        payload: {
          orderId: transaction.orderId,
          paymentId: transaction.id,
          amount: transaction.amount,
        },
      });
    } catch (error) {
      this.logger.error(
        {
          error,
          tenantId: transaction.tenantId,
          transactionId: transaction.id,
        },
        "Payment notification event failed",
      );
    }
  }

  private async publishRefundApproved(
    refundRequest: RefundRequest,
  ): Promise<void> {
    if (!this.notificationPublisher) {
      return;
    }

    try {
      await this.notificationPublisher.publish(
        refundApprovedEvent({
          tenantId: refundRequest.tenantId,
          branchId: refundRequest.branchId,
          customerId: refundRequest.customerId,
          refundRequestId: refundRequest.id,
          orderId: refundRequest.orderId,
          amount: refundRequest.amount,
          reason: refundRequest.reason,
          status: refundRequest.status,
        }),
      );
    } catch (error) {
      this.logger.error(
        {
          error,
          tenantId: refundRequest.tenantId,
          refundRequestId: refundRequest.id,
        },
        "Refund approved notification event failed",
      );
    }
  }

  private async publishRefundRejected(
    refundRequest: RefundRequest,
  ): Promise<void> {
    if (!this.notificationPublisher) {
      return;
    }

    try {
      await this.notificationPublisher.publish(
        refundRejectedEvent({
          tenantId: refundRequest.tenantId,
          branchId: refundRequest.branchId,
          customerId: refundRequest.customerId,
          refundRequestId: refundRequest.id,
          orderId: refundRequest.orderId,
          amount: refundRequest.amount,
          reason: refundRequest.reason,
          rejectionReason: refundRequest.rejectionReason,
        }),
      );
    } catch (error) {
      this.logger.error(
        {
          error,
          tenantId: refundRequest.tenantId,
          refundRequestId: refundRequest.id,
        },
        "Refund rejected notification event failed",
      );
    }
  }
}
