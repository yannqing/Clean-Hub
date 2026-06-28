import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  buildDeliveryLabelText,
  buildDeliveryReceiptText,
  type DeliveryPrintTask,
} from "@cleanhub/hardware";

type JsonObject = Record<string, unknown>;

const API_BASE_URL =
  process.env.MOBILE_E2E_API_BASE_URL ??
  process.env.CLEANHUB_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

const TENANT_CODE = process.env.MOBILE_E2E_TENANT_CODE ?? "CLEAN-001";
const PASSWORD = process.env.MOBILE_E2E_PASSWORD ?? "123456";
const PAYMENT_MOCK_SECRET =
  process.env.PAYMENT_MOCK_SECRET ?? "cleanhub-mock-payment-secret";
const DEVICE_ID = `mobile-e2e-${Date.now()}`;

const FIXTURES = {
  tenantId: "01KRERJN800000000000000001",
  branchId: "01KRERJN8G0000000000000040",
  customerAccountId: "01SEED0100ACC0000000000001",
  customerId: "01SEED0100CUS0000000000001",
  customerPhone: "13800000001",
  customerIdentifier: "zhang.wei@example.com",
  driverId: "01SEEDM0B0USR00000000001",
  driverIdentifier: "mobile.driver1@cleanhub.local",
  ownerIdentifier: "tenant.admin1@cleanhub.local",
  orderId: "01SEED0100ORD0000000000002",
  ticketId: "01SEED0100TKT0000000000001",
} as const;

type MobileTokenResponse = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  authContext: {
    subjectType: "customer" | "staff";
    subjectId: string;
    tenantId: string;
    role: "customer" | "driver" | "owner";
  };
};

type ApiResponse<T> = {
  status: number;
  headers: Headers;
  body: T;
};

type MediaUploadTicket = {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
};

type PaymentInitiationResponse = {
  transaction: {
    id: string;
    orderId: string;
    amount: string;
    paymentStatus: "pending" | "paid" | "refunded" | "failed";
  };
  gateway: {
    gateway: "mock";
    externalId: string;
    paymentUrl: string;
    paymentToken: string;
    expiresAt: string;
  };
  idempotent: boolean;
};

type RefundRequestResponse = {
  id: string;
  amount: string;
  orderId: string;
  paymentTransactionId: string | null;
  status: "pending" | "processing" | "rejected" | "refunded" | "failed";
  externalId: string | null;
};

function idempotencyKey(label: string): string {
  return `${DEVICE_ID}-${label}`;
}

function amountToCents(value: string): number {
  return Math.round(Number.parseFloat(value) * 100);
}

function centsToAmount(value: number): string {
  return (value / 100).toFixed(2);
}

function normalizePrintableText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

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

function signMockPaymentPayload(payload: JsonObject): string {
  return createHmac("sha256", PAYMENT_MOCK_SECRET)
    .update(stableStringify(payload))
    .digest("hex");
}

async function sendMockPaymentWebhook(
  payload: JsonObject,
  expectedStatus: number | number[] = 200,
): Promise<void> {
  await request("/mobile/payment/webhooks/mock", {
    expectedStatus,
    body: payload,
    headers: {
      "X-CleanHub-Mock-Signature": signMockPaymentPayload(payload),
    },
  });
}

async function request<T = JsonObject>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: JsonObject;
    headers?: Record<string, string>;
    expectedStatus?: number | number[];
  } = {},
): Promise<ApiResponse<T>> {
  const expectedStatuses = Array.isArray(options.expectedStatus)
    ? options.expectedStatus
    : [options.expectedStatus ?? 200];
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
      "X-Device-Id": DEVICE_ID,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as T) : ({} as T);

  assert(
    expectedStatuses.includes(response.status),
    `${options.method ?? "GET"} ${path} expected ${expectedStatuses.join(
      "/",
    )}, got ${response.status}: ${text}`,
  );

  return { status: response.status, headers: response.headers, body };
}

async function uploadMedia(input: {
  token: string;
  taskId: string;
  purpose: "delivery_proof" | "delivery_signature";
  contentType: string;
  body: Blob;
}): Promise<string> {
  const ticket = await request<MediaUploadTicket>("/mobile/media/uploads", {
    expectedStatus: 201,
    token: input.token,
    body: {
      purpose: input.purpose,
      contentType: input.contentType,
      sizeBytes: input.body.size,
      entityId: input.taskId,
    },
  });
  const upload = await fetch(ticket.body.uploadUrl, {
    method: "PUT",
    headers: ticket.body.headers,
    body: input.body,
  });

  assert.equal(
    upload.status,
    200,
    `PUT media upload expected 200, got ${upload.status}`,
  );

  return ticket.body.objectKey;
}

function assertToken(
  response: ApiResponse<MobileTokenResponse>,
  expectedRole: MobileTokenResponse["authContext"]["role"],
): MobileTokenResponse {
  assert.equal(response.body.tokenType, "Bearer");
  assert.equal(response.body.authContext.role, expectedRole);
  assert.equal(response.body.authContext.tenantId, FIXTURES.tenantId);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.ok(response.body.accessToken.length > 40);
  assert.ok(response.body.refreshToken.length > 40);

  return response.body;
}

async function loginCustomerWithOtp(): Promise<MobileTokenResponse> {
  await request("/mobile/auth/customer/otp/request", {
    expectedStatus: 201,
    body: {
      tenantCode: TENANT_CODE,
      phone: FIXTURES.customerPhone,
      deviceId: DEVICE_ID,
    },
  });
  const otp = await request<{ code: string }>("/mobile/auth/customer/otp/test" +
    `?tenantCode=${encodeURIComponent(TENANT_CODE)}` +
    `&phone=${encodeURIComponent(FIXTURES.customerPhone)}`);

  assert.match(otp.body.code, /^\d{6}$/);

  return assertToken(
    await request<MobileTokenResponse>("/mobile/auth/customer/otp/verify", {
      body: {
        tenantCode: TENANT_CODE,
        phone: FIXTURES.customerPhone,
        code: otp.body.code,
        deviceId: DEVICE_ID,
      },
    }),
    "customer",
  );
}

async function loginCustomerWithPassword(): Promise<MobileTokenResponse> {
  return assertToken(
    await request<MobileTokenResponse>("/mobile/auth/customer/password", {
      body: {
        tenantCode: TENANT_CODE,
        identifier: FIXTURES.customerIdentifier,
        password: PASSWORD,
        deviceId: DEVICE_ID,
      },
    }),
    "customer",
  );
}

async function loginDriver(): Promise<MobileTokenResponse> {
  const token = assertToken(
    await request<MobileTokenResponse>("/mobile/auth/staff/driver/login", {
      body: {
        tenantCode: TENANT_CODE,
        identifier: FIXTURES.driverIdentifier,
        password: PASSWORD,
        deviceId: DEVICE_ID,
      },
    }),
    "driver",
  );

  assert.equal(token.authContext.subjectId, FIXTURES.driverId);

  return token;
}

async function loginOwner(): Promise<MobileTokenResponse> {
  return assertToken(
    await request<MobileTokenResponse>("/mobile/auth/staff/owner/login", {
      body: {
        tenantCode: TENANT_CODE,
        identifier: FIXTURES.ownerIdentifier,
        password: PASSWORD,
        deviceId: DEVICE_ID,
      },
    }),
    "owner",
  );
}

async function verifyCustomerFlow(token: MobileTokenResponse): Promise<void> {
  const profile = await request<{
    account: { id: string; accountName: string };
    addresses: Array<{ customerId: string }>;
  }>("/mobile/customer/profile", { token: token.accessToken });

  assert.equal(profile.body.account.id, FIXTURES.customerAccountId);
  assert.ok(profile.body.addresses.some((item) => item.customerId === FIXTURES.customerId));

  const updatedProfile = await request<{
    account: { id: string; accountName: string; email: string | null };
  }>("/mobile/customer/profile", {
    method: "PATCH",
    token: token.accessToken,
    body: {
      accountName: profile.body.account.accountName,
      email: "zhang.wei@example.com",
    },
  });

  assert.equal(updatedProfile.body.account.id, FIXTURES.customerAccountId);
  assert.equal(updatedProfile.body.account.email, "zhang.wei@example.com");

  const address = await request<{ id: string; isDefault: boolean; addressLine1: string }>(
    "/mobile/customer/addresses",
    {
      expectedStatus: 201,
      token: token.accessToken,
      body: {
        customerId: FIXTURES.customerId,
        label: "Mobile E2E",
        contactName: "Zhang Wei",
        contactPhone: FIXTURES.customerPhone,
        addressLine1: "Mobile E2E address",
        city: "Shanghai",
        country: "CN",
        latitude: "31.2304000",
        longitude: "121.4737000",
        isDefault: true,
      },
    },
  );

  assert.equal(address.body.isDefault, true);

  const addressList = await request<{ data: Array<{ id: string; isDefault: boolean }> }>(
    "/mobile/customer/addresses",
    { token: token.accessToken },
  );
  assert.ok(addressList.body.data.some((item) => item.id === address.body.id));

  const updatedAddress = await request<{ id: string; addressLine1: string }>(
    `/mobile/customer/addresses/${address.body.id}`,
    {
      method: "PATCH",
      token: token.accessToken,
      body: {
        customerId: FIXTURES.customerId,
        label: "Mobile E2E Updated",
        addressLine1: "Mobile E2E updated address",
        country: "CN",
      },
    },
  );
  assert.equal(updatedAddress.body.addressLine1, "Mobile E2E updated address");

  const defaultAddress = await request<{ id: string; isDefault: boolean }>(
    `/mobile/customer/addresses/${address.body.id}/default`,
    { method: "POST", token: token.accessToken },
  );
  assert.equal(defaultAddress.body.isDefault, true);

  await request(`/mobile/customer/addresses/${address.body.id}`, {
    method: "DELETE",
    token: token.accessToken,
  });

  const activities = await request<{
    data: {
      orders: Array<{ id: string }>;
      tickets: Array<{ id: string }>;
    };
  }>("/mobile/customer/orders", { token: token.accessToken });

  assert.ok(activities.body.data.orders.some((order) => order.id === FIXTURES.orderId));
  assert.ok(activities.body.data.tickets.some((ticket) => ticket.id === FIXTURES.ticketId));

  const order = await request<{ id: string }>(
    `/mobile/customer/orders/${FIXTURES.orderId}`,
    { token: token.accessToken },
  );
  assert.equal(order.body.id, FIXTURES.orderId);

  const ticket = await request<{ id: string }>(
    `/mobile/customer/tickets/${FIXTURES.ticketId}`,
    { token: token.accessToken },
  );
  assert.equal(ticket.body.id, FIXTURES.ticketId);

  const appointment = await request<{ id: string; status: string }>(
    "/mobile/customer/appointments",
    {
      expectedStatus: 201,
      token: token.accessToken,
      body: {
        type: "pickup",
        expectedAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        address: "Shanghai Mobile E2E appointment address",
        customerId: FIXTURES.customerId,
        notes: "Created by mobile HTTP E2E",
      },
    },
  );

  assert.equal(appointment.body.status, "pending");

  const appointments = await request<{ data: Array<{ id: string }> }>(
    "/mobile/customer/appointments",
    { token: token.accessToken },
  );
  assert.ok(appointments.body.data.some((item) => item.id === appointment.body.id));

  const cancelled = await request<{ id: string; status: string }>(
    `/mobile/customer/appointments/${appointment.body.id}/cancel`,
    { method: "POST", token: token.accessToken },
  );
  assert.equal(cancelled.body.status, "cancelled");
}

function verifyPrintTemplates(task: {
  id: string;
  type: "pickup" | "dropoff";
  customerName: string;
  customerPhone: string;
  address: string;
  orderId: string;
  ticketId: string;
  expectedAt?: string;
}): void {
  const printable: DeliveryPrintTask = {
    taskId: task.id,
    kind: task.type === "pickup" ? "pickup" : "delivery",
    customer: {
      name: task.customerName,
      phone: task.customerPhone,
    },
    address: task.address,
    orderId: task.orderId,
    workOrderId: task.ticketId,
    scheduledAt: task.expectedAt,
  };
  const receipt = buildDeliveryReceiptText(printable, { locale: "fr" });
  const label = buildDeliveryLabelText(printable, { locale: "fr" });

  for (const content of [receipt, label]) {
    const normalizedContent = normalizePrintableText(content);

    assert.match(normalizedContent, new RegExp(task.id));
    assert.match(normalizedContent, new RegExp(task.customerName));
    assert.match(normalizedContent, new RegExp(task.address));
    assert.match(normalizedContent, new RegExp(task.orderId));
    assert.match(normalizedContent, new RegExp(task.ticketId));
  }
}

async function createDeliveryTask(
  token: MobileTokenResponse,
): Promise<{
  id: string;
  status: string;
  type: "pickup" | "dropoff";
  customerName: string;
  customerPhone: string;
  address: string;
  orderId: string;
  ticketId: string;
  expectedAt?: string;
}> {
  return (
    await request<{
      id: string;
      status: string;
      type: "pickup" | "dropoff";
      customerName: string;
      customerPhone: string;
      address: string;
      orderId: string;
      ticketId: string;
      expectedAt?: string;
    }>("/mobile/delivery/tasks", {
      expectedStatus: 201,
      token: token.accessToken,
      body: {
        tenantId: FIXTURES.tenantId,
        branchId: FIXTURES.branchId,
        assigneeUserId: FIXTURES.driverId,
        customerId: FIXTURES.customerId,
        type: "pickup",
        customerName: "Zhang Wei",
        customerPhone: FIXTURES.customerPhone,
        address: "100 Renmin Road, Huangpu District, Shanghai",
        orderId: FIXTURES.orderId,
        ticketId: FIXTURES.ticketId,
        expectedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        notes: "Created by mobile HTTP E2E",
      },
    })
  ).body;
}

async function verifyDeliveryFlow(token: MobileTokenResponse): Promise<void> {
  const task = await createDeliveryTask(token);

  assert.equal(task.status, "pending_dispatch");
  verifyPrintTemplates(task);

  const tasks = await request<{ data: Array<{ id: string }> }>(
    "/mobile/delivery/tasks/today",
    { token: token.accessToken },
  );
  assert.ok(tasks.body.data.some((item) => item.id === task.id));

  const detail = await request<{ id: string; order: unknown; ticket: unknown }>(
    `/mobile/delivery/tasks/${task.id}`,
    { token: token.accessToken },
  );
  assert.equal(detail.body.id, task.id);
  assert.ok(detail.body.order);
  assert.ok(detail.body.ticket);

  const firstStatus = await request<{ idempotent: boolean; task: { status: string } }>(
    `/mobile/delivery/tasks/${task.id}/status`,
    {
      token: token.accessToken,
      body: {
        toStatus: "en_route",
        idempotencyKey: idempotencyKey("en-route"),
        lat: "31.2304000",
        lng: "121.4737000",
        deviceId: DEVICE_ID,
      },
    },
  );
  assert.equal(firstStatus.body.idempotent, false);
  assert.equal(firstStatus.body.task.status, "en_route");

  const replayedStatus = await request<{ idempotent: boolean; task: { status: string } }>(
    `/mobile/delivery/tasks/${task.id}/status`,
    {
      token: token.accessToken,
      body: {
        toStatus: "en_route",
        idempotencyKey: idempotencyKey("en-route"),
        lat: "31.2304000",
        lng: "121.4737000",
        deviceId: DEVICE_ID,
      },
    },
  );
  assert.equal(replayedStatus.body.idempotent, true);
  assert.equal(replayedStatus.body.task.status, "en_route");

  await request(`/mobile/delivery/tasks/${task.id}/status`, {
    expectedStatus: 409,
    token: token.accessToken,
    body: {
      toStatus: "signed",
      idempotencyKey: idempotencyKey("illegal-signed"),
      deviceId: DEVICE_ID,
    },
  });

  for (const toStatus of ["arrived", "picked_up", "delivering"] as const) {
    const result = await request<{ task: { status: string } }>(
      `/mobile/delivery/tasks/${task.id}/status`,
      {
        token: token.accessToken,
        body: {
          toStatus,
          idempotencyKey: idempotencyKey(toStatus),
          lat: "31.2304000",
          lng: "121.4737000",
          deviceId: DEVICE_ID,
        },
      },
    );
    assert.equal(result.body.task.status, toStatus);
  }

  await request(`/mobile/delivery/tasks/${task.id}/proofs`, {
    expectedStatus: 422,
    token: token.accessToken,
    body: {
      type: "pickup",
      idempotencyKey: idempotencyKey("proof-base64-rejected"),
      base64: "ZmFrZQ==",
      mimeType: "image/jpeg",
      deviceId: DEVICE_ID,
    },
  });

  const proofObjectKey = await uploadMedia({
    token: token.accessToken,
    taskId: task.id,
    purpose: "delivery_proof",
    contentType: "image/jpeg",
    body: new Blob(["cleanhub mobile e2e proof"], { type: "image/jpeg" }),
  });

  const proof = await request<{ idempotent: boolean; proof: { type: string } }>(
    `/mobile/delivery/tasks/${task.id}/proofs`,
    {
      expectedStatus: 201,
      token: token.accessToken,
      body: {
        type: "pickup",
        idempotencyKey: idempotencyKey("proof-pickup"),
        mediaRef: proofObjectKey,
        deviceId: DEVICE_ID,
      },
    },
  );
  assert.equal(proof.body.idempotent, false);
  assert.equal(proof.body.proof.type, "pickup");

  const proofReplay = await request<{ idempotent: boolean }>(
    `/mobile/delivery/tasks/${task.id}/proofs`,
    {
      expectedStatus: 201,
      token: token.accessToken,
      body: {
        type: "pickup",
        idempotencyKey: idempotencyKey("proof-pickup"),
        mediaRef: proofObjectKey,
        deviceId: DEVICE_ID,
      },
    },
  );
  assert.equal(proofReplay.body.idempotent, true);

  const proofDetail = await request<{
    proofs: Array<{ mediaRef: string; mediaUrl?: string }>;
  }>(`/mobile/delivery/tasks/${task.id}`, { token: token.accessToken });
  const uploadedProof = proofDetail.body.proofs.find(
    (item) => item.mediaRef === proofObjectKey,
  );

  assert.ok(uploadedProof?.mediaUrl);
  assert.equal((await fetch(uploadedProof.mediaUrl)).status, 200);

  await request(`/mobile/delivery/tasks/${task.id}/signature`, {
    expectedStatus: 422,
    token: token.accessToken,
    body: {
      idempotencyKey: idempotencyKey("signature-base64-rejected"),
      signatureBase64: "ZmFrZQ==",
      mimeType: "image/png",
      deviceId: DEVICE_ID,
    },
  });

  const signatureObjectKey = await uploadMedia({
    token: token.accessToken,
    taskId: task.id,
    purpose: "delivery_signature",
    contentType: "image/png",
    body: new Blob(["cleanhub mobile e2e signature"], { type: "image/png" }),
  });

  const signed = await request<{ task: { status: string }; proof: { type: string } }>(
    `/mobile/delivery/tasks/${task.id}/signature`,
    {
      token: token.accessToken,
      body: {
        idempotencyKey: idempotencyKey("signature"),
        signatureMediaRef: signatureObjectKey,
        lat: "31.2304000",
        lng: "121.4737000",
        deviceId: DEVICE_ID,
        signedByName: "Zhang Wei",
      },
    },
  );
  assert.equal(signed.body.task.status, "signed");
  assert.equal(signed.body.proof.type, "signature");

  await request(`/mobile/delivery/tasks/${task.id}/status`, {
    expectedStatus: 409,
    token: token.accessToken,
    body: {
      toStatus: "arrived",
      idempotencyKey: idempotencyKey("terminal-overwrite"),
      deviceId: DEVICE_ID,
    },
  });
}

async function verifyOwnerFlow(token: MobileTokenResponse): Promise<void> {
  const summary = await request<{
    tenantId: string;
    todayOrderCount: number;
    deliverySummary: { signed: number };
    featureFlags: { deliveryEnabled: boolean };
  }>("/mobile/owner/summary/today", { token: token.accessToken });

  assert.equal(summary.body.tenantId, FIXTURES.tenantId);
  assert.equal(summary.body.featureFlags.deliveryEnabled, true);
  assert.ok(summary.body.todayOrderCount >= 0);
  assert.ok(summary.body.deliverySummary.signed >= 1);
}

async function verifyPaymentFlow(input: {
  customer: MobileTokenResponse;
  owner: MobileTokenResponse;
}): Promise<void> {
  const startingOrder = await request<{
    paymentStatus: string;
    totalAmount: string;
    paidAmount: string;
  }>(`/mobile/customer/orders/${FIXTURES.orderId}`, {
    token: input.customer.accessToken,
  });
  const startingPaidCents = amountToCents(startingOrder.body.paidAmount);
  const balanceCents =
    amountToCents(startingOrder.body.totalAmount) - startingPaidCents;
  const paymentCents = Math.min(Math.max(balanceCents, 1), 1000);
  const paymentAmount = centsToAmount(paymentCents);

  assert.ok(balanceCents > 0, "payment flow requires a positive order balance");

  await request(`/mobile/payment/orders/${FIXTURES.orderId}/payments`, {
    expectedStatus: 422,
    token: input.customer.accessToken,
    body: {
      amount: "999.00",
      idempotencyKey: idempotencyKey("payment-over"),
    },
  });

  const payment = await request<PaymentInitiationResponse>(
    `/mobile/payment/orders/${FIXTURES.orderId}/payments`,
    {
      expectedStatus: 201,
      token: input.customer.accessToken,
      body: {
        amount: paymentAmount,
        idempotencyKey: idempotencyKey("payment-balance"),
      },
    },
  );

  assert.equal(payment.body.transaction.paymentStatus, "pending");
  assert.equal(payment.body.gateway.gateway, "mock");
  assert.match(payment.body.gateway.paymentUrl, /\/payments\/mock/);

  const replay = await request<PaymentInitiationResponse>(
    `/mobile/payment/orders/${FIXTURES.orderId}/payments`,
    {
      expectedStatus: 201,
      token: input.customer.accessToken,
      body: {
        amount: paymentAmount,
        idempotencyKey: idempotencyKey("payment-balance"),
      },
    },
  );
  assert.equal(replay.body.idempotent, true);
  assert.equal(replay.body.transaction.id, payment.body.transaction.id);

  await request(`/mobile/payment/payments/${payment.body.transaction.id}/mock-callback`, {
    token: input.customer.accessToken,
    body: {
      status: "paid",
    },
  });

  await sendMockPaymentWebhook({
    gateway: "mock",
    action: "pay",
    tenantId: FIXTURES.tenantId,
    externalId: payment.body.gateway.externalId,
    event: `mock.payment.paid.${payment.body.transaction.id}`,
    status: "paid",
    amount: paymentAmount,
    transactionId: payment.body.transaction.id,
    occurredAt: new Date().toISOString(),
  });

  await request("/mobile/payment/webhooks/mock", {
    expectedStatus: 200,
    body: {
      gateway: "mock",
      action: "pay",
      tenantId: FIXTURES.tenantId,
      externalId: `${DEVICE_ID}.invalid`,
      event: `${DEVICE_ID}.payment.invalid`,
      status: "paid",
      amount: "10.00",
      transactionId: "missing",
      occurredAt: new Date().toISOString(),
    },
    headers: {
      "X-CleanHub-Mock-Signature": "bad",
    },
  });

  const paidStatus = await request<{
    transaction: { paymentStatus: string; amount: string };
  }>(`/mobile/payment/payments/${payment.body.transaction.id}`, {
    token: input.customer.accessToken,
  });

  assert.equal(paidStatus.body.transaction.paymentStatus, "paid");

  const paidOrder = await request<{ paymentStatus: string; paidAmount: string }>(
    `/mobile/customer/orders/${FIXTURES.orderId}`,
    { token: input.customer.accessToken },
  );
  assert.ok(["paid", "partial"].includes(paidOrder.body.paymentStatus));
  assert.equal(
    paidOrder.body.paidAmount,
    centsToAmount(startingPaidCents + paymentCents),
  );

  await request(`/mobile/payment/orders/${FIXTURES.orderId}/refund-requests`, {
    expectedStatus: 422,
    token: input.customer.accessToken,
    body: {
      amount: "999.00",
      reason: "Too much",
    },
  });

  const refundCents = Math.min(paymentCents, 1000);
  const refundAmount = centsToAmount(refundCents);
  const refund = await request<RefundRequestResponse>(
    `/mobile/payment/orders/${FIXTURES.orderId}/refund-requests`,
    {
      expectedStatus: 201,
      token: input.customer.accessToken,
      body: {
        amount: refundAmount,
        reason: "Mobile E2E refund request",
      },
    },
  );
  assert.equal(refund.body.status, "pending");

  await request(`/mobile/payment/refund-requests/${refund.body.id}/approve`, {
    method: "POST",
    expectedStatus: 403,
    token: input.customer.accessToken,
  });

  const approved = await request<{
    refundRequest: RefundRequestResponse;
    gateway: { externalId: string };
  }>(`/mobile/payment/refund-requests/${refund.body.id}/approve`, {
    method: "POST",
    token: input.owner.accessToken,
  });

  assert.equal(approved.body.refundRequest.status, "processing");

  await sendMockPaymentWebhook({
    gateway: "mock",
    action: "refund",
    tenantId: FIXTURES.tenantId,
    externalId: approved.body.gateway.externalId,
    event: `${DEVICE_ID}.refund.succeeded`,
    status: "refunded",
    amount: refundAmount,
    transactionId: payment.body.transaction.id,
    refundRequestId: refund.body.id,
    occurredAt: new Date().toISOString(),
  });

  const refundList = await request<{
    data: Array<{ id: string; status: string }>;
  }>("/mobile/payment/refund-requests", {
    token: input.customer.accessToken,
  });
  assert.ok(
    refundList.body.data.some(
      (item) => item.id === refund.body.id && item.status === "refunded",
    ),
  );

  const refundedOrder = await request<{ paidAmount: string }>(
    `/mobile/customer/orders/${FIXTURES.orderId}`,
    { token: input.customer.accessToken },
  );
  assert.equal(
    refundedOrder.body.paidAmount,
    centsToAmount(startingPaidCents + paymentCents - refundCents),
  );
}

async function verifyAccessIsolation(input: {
  customer: MobileTokenResponse;
  driver: MobileTokenResponse;
  owner: MobileTokenResponse;
}): Promise<void> {
  await request("/mobile/delivery/tasks/today", {
    expectedStatus: 403,
    token: input.customer.accessToken,
  });
  await request("/mobile/owner/summary/today", {
    expectedStatus: 403,
    token: input.customer.accessToken,
  });
  await request("/mobile/owner/summary/today", {
    expectedStatus: 403,
    token: input.driver.accessToken,
  });
  await request("/mobile/customer/profile", {
    expectedStatus: 403,
    token: input.driver.accessToken,
  });
  await request("/mobile/customer/profile", {
    expectedStatus: 403,
    token: input.owner.accessToken,
  });
  await request("/mobile/auth/customer/password", {
    expectedStatus: 401,
    body: {
      tenantCode: "CLEAN-404",
      identifier: FIXTURES.customerIdentifier,
      password: PASSWORD,
      deviceId: DEVICE_ID,
    },
  });
}

async function verifyRefreshAndLogout(token: MobileTokenResponse): Promise<void> {
  const refreshed = assertToken(
    await request<MobileTokenResponse>("/mobile/auth/refresh", {
      body: {
        refreshToken: token.refreshToken,
        deviceId: DEVICE_ID,
      },
    }),
    "customer",
  );

  await request("/mobile/auth/logout", {
    expectedStatus: 204,
    body: {
      refreshToken: refreshed.refreshToken,
      deviceId: DEVICE_ID,
    },
  });
  await request("/mobile/auth/refresh", {
    expectedStatus: 401,
    body: {
      refreshToken: refreshed.refreshToken,
      deviceId: DEVICE_ID,
    },
  });
}

async function main(): Promise<void> {
  await request("/health");

  const otpCustomer = await loginCustomerWithOtp();
  const passwordCustomer = await loginCustomerWithPassword();
  const driver = await loginDriver();
  const owner = await loginOwner();

  await verifyCustomerFlow(otpCustomer);
  await verifyRefreshAndLogout(passwordCustomer);
  await verifyPaymentFlow({ customer: otpCustomer, owner });
  await verifyDeliveryFlow(driver);
  await verifyOwnerFlow(owner);
  await verifyAccessIsolation({ customer: otpCustomer, driver, owner });

  console.log("Mobile HTTP E2E passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
