import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  PaymentGateway,
  PaymentGatewayCallbackVerification,
  PaymentGatewayName,
  PaymentGatewayPaymentRequest,
  PaymentGatewayPaymentResult,
  PaymentGatewayRefundRequest,
  PaymentGatewayRefundResult,
} from "./payment.types.js";

type MockPaymentGatewayOptions = {
  secret: string;
  paymentBaseUrl: string;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function signPayload(payload: Record<string, unknown>, secret: string): string {
  return createHmac("sha256", secret).update(stableStringify(payload)).digest("hex");
}

function readString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function toCallbackStatus(
  value: string | null,
): PaymentGatewayCallbackVerification["status"] {
  if (
    value === "pending" ||
    value === "paid" ||
    value === "refunded" ||
    value === "failed"
  ) {
    return value;
  }

  return "failed";
}

function toAction(
  value: string | null,
): PaymentGatewayCallbackVerification["action"] {
  return value === "refund" ? "refund" : "pay";
}

function safeCompare(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export class MockPaymentGateway implements PaymentGateway {
  readonly name: PaymentGatewayName = "mock";

  constructor(private readonly options: MockPaymentGatewayOptions) {}

  async createPayment(
    input: PaymentGatewayPaymentRequest,
  ): Promise<PaymentGatewayPaymentResult> {
    const externalId = `mock_pay_${input.transactionId}`;
    const paymentToken = signPayload(
      {
        action: "pay",
        amount: input.amount,
        externalId,
        tenantId: input.tenantId,
        transactionId: input.transactionId,
      },
      this.options.secret,
    ).slice(0, 32);
    const url = new URL("/payments/mock", this.options.paymentBaseUrl);

    url.searchParams.set("paymentId", input.transactionId);
    url.searchParams.set("externalId", externalId);

    return {
      gateway: this.name,
      externalId,
      paymentUrl: url.toString(),
      paymentToken,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  async verifyCallback(input: {
    payload: Record<string, unknown>;
    headers: Record<string, string | undefined>;
  }): Promise<PaymentGatewayCallbackVerification> {
    const signature =
      input.headers["x-cleanhub-mock-signature"] ??
      input.headers["X-CleanHub-Mock-Signature"];
    const gateway = readString(input.payload, "gateway");
    const externalId = readString(input.payload, "externalId");
    const event = readString(input.payload, "event");
    const action = toAction(readString(input.payload, "action"));
    const status = toCallbackStatus(readString(input.payload, "status"));
    const amount = readString(input.payload, "amount");
    const tenantId = readString(input.payload, "tenantId");
    const transactionId = readString(input.payload, "transactionId") ?? undefined;
    const refundRequestId =
      readString(input.payload, "refundRequestId") ?? undefined;
    const occurredAtValue = readString(input.payload, "occurredAt");
    const occurredAt = occurredAtValue ? new Date(occurredAtValue) : new Date();
    const expectedSignature = signPayload(input.payload, this.options.secret);

    if (
      gateway !== this.name ||
      !externalId ||
      !event ||
      !amount ||
      !tenantId ||
      !signature ||
      !safeCompare(signature, expectedSignature)
    ) {
      return {
        ok: false,
        gateway: this.name,
        externalId: externalId ?? "unknown",
        event: event ?? "unknown",
        action,
        status,
        amount: amount ?? "0.00",
        tenantId: tenantId ?? "",
        transactionId,
        refundRequestId,
        occurredAt,
        failureReason: "Mock payment callback signature or payload is invalid.",
      };
    }

    return {
      ok: true,
      gateway: this.name,
      externalId,
      event,
      action,
      status,
      amount,
      tenantId,
      transactionId,
      refundRequestId,
      occurredAt,
    };
  }

  async queryPayment(): Promise<{
    status: PaymentGatewayCallbackVerification["status"];
  }> {
    return { status: "pending" };
  }

  async createRefund(
    input: PaymentGatewayRefundRequest,
  ): Promise<PaymentGatewayRefundResult> {
    return {
      gateway: this.name,
      externalId: `mock_refund_${input.refundRequestId}`,
    };
  }

  createSignedCallbackPayload(input: {
    action: "pay" | "refund";
    tenantId: string;
    externalId: string;
    event: string;
    status: "paid" | "failed" | "refunded";
    amount: string;
    transactionId?: string;
    refundRequestId?: string;
    occurredAt?: Date;
  }): {
    payload: Record<string, unknown>;
    headers: Record<string, string>;
  } {
    const payload = {
      gateway: this.name,
      action: input.action,
      tenantId: input.tenantId,
      externalId: input.externalId,
      event: input.event,
      status: input.status,
      amount: input.amount,
      transactionId: input.transactionId,
      refundRequestId: input.refundRequestId,
      occurredAt: (input.occurredAt ?? new Date()).toISOString(),
    };

    return {
      payload,
      headers: {
        "x-cleanhub-mock-signature": signPayload(payload, this.options.secret),
      },
    };
  }
}
