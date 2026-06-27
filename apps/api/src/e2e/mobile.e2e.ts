import assert from "node:assert/strict";

type JsonObject = Record<string, unknown>;

const API_BASE_URL =
  process.env.MOBILE_E2E_API_BASE_URL ??
  process.env.CLEANHUB_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000";

const TENANT_CODE = process.env.MOBILE_E2E_TENANT_CODE ?? "CLEAN-001";
const PASSWORD = process.env.MOBILE_E2E_PASSWORD ?? "123456";
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

function idempotencyKey(label: string): string {
  return `${DEVICE_ID}-${label}`;
}

async function request<T = JsonObject>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: JsonObject;
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
    account: { id: string };
    addresses: Array<{ customerId: string }>;
  }>("/mobile/customer/profile", { token: token.accessToken });

  assert.equal(profile.body.account.id, FIXTURES.customerAccountId);
  assert.ok(profile.body.addresses.some((item) => item.customerId === FIXTURES.customerId));

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

async function createDeliveryTask(
  token: MobileTokenResponse,
): Promise<{ id: string; status: string }> {
  return (
    await request<{ id: string; status: string }>("/mobile/delivery/tasks", {
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

  const proof = await request<{ idempotent: boolean; proof: { type: string } }>(
    `/mobile/delivery/tasks/${task.id}/proofs`,
    {
      expectedStatus: 201,
      token: token.accessToken,
      body: {
        type: "pickup",
        idempotencyKey: idempotencyKey("proof-pickup"),
        mediaRef: "e2e://pickup-proof.jpg",
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
        mediaRef: "e2e://pickup-proof.jpg",
        deviceId: DEVICE_ID,
      },
    },
  );
  assert.equal(proofReplay.body.idempotent, true);

  const signed = await request<{ task: { status: string }; proof: { type: string } }>(
    `/mobile/delivery/tasks/${task.id}/signature`,
    {
      token: token.accessToken,
      body: {
        idempotencyKey: idempotencyKey("signature"),
        signatureMediaRef: "e2e://signature.png",
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
  await verifyDeliveryFlow(driver);
  await verifyOwnerFlow(owner);
  await verifyAccessIsolation({ customer: otpCustomer, driver, owner });

  console.log("Mobile HTTP E2E passed.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
