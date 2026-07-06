import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

const API_BASE_URL = process.env.MOBILE_WEB_E2E_API_BASE_URL ?? "http://localhost:4100";
const TENANT_CODE = process.env.MOBILE_E2E_TENANT_CODE ?? "CLEAN-001";
const PASSWORD = process.env.MOBILE_E2E_PASSWORD ?? "123456";

type AuthContext = {
  subjectId: string;
  tenantId: string;
  currency: string;
  role: "customer" | "driver" | "owner";
};

type TokenResponse = {
  accessToken: string;
  authContext: AuthContext;
};

type CustomerActivityResponse = {
  data: {
    orders: Array<{
      id: string;
      paymentStatus: string;
      totalAmount: string;
      paidAmount: string;
    }>;
    tickets: Array<{ id: string }>;
  };
};

type CustomerOrderDetailResponse = {
  id: string;
  paymentStatus: string;
  totalAmount: string;
  paidAmount: string;
};

type CustomerProfileResponse = {
  account: { id: string };
  addresses: Array<{ customerId: string }>;
};

type OwnerBranchesResponse = {
  data: Array<{ id: string; name: string }>;
};

type DeliveryTaskResponse = {
  id: string;
  customerName: string;
  address: string;
};

type DeliveryTaskDetailResponse = DeliveryTaskResponse & {
  status: string;
};

type PosOrderResponse = {
  id: string;
  paymentStatus: string;
  totalAmount: string;
  paidAmount: string;
};

type PaymentStatusResponse = {
  transaction: {
    id: string;
    paymentStatus: string;
  };
};

const SEEDED_PRODUCT_SOURCE_ID = "01SEED0100SVC0000000000008";
const PAID_STATUS_PATTERN = /^paid$|^已付$/i;
const PENDING_SYNC_PATTERN =
  /1 pending sync|1 to sync|1 个操作待同步|1 个待同步/i;

async function apiHealth(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/health`);

  expect(response.status, `API health at ${API_BASE_URL}/health`).toBe(200);
}

function amountToCents(value: string): number {
  const [whole, fraction = ""] = value.split(".");
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(fraction.padEnd(2, "0").slice(0, 2), 10);
}

function getPaymentIdFromUrl(url: string): string {
  const paymentId = new URL(url).searchParams.get("paymentId");

  expect(paymentId, `Payment URL should include paymentId: ${url}`).toBeTruthy();
  return paymentId ?? "";
}

function workspaceReadyPattern(role: "customer" | "driver" | "owner"): RegExp {
  if (role === "customer") {
    return /服务中心|Service center/;
  }

  if (role === "driver") {
    return /路线和客户凭证|Route and customer proofs/;
  }

  return /今日运营|Today's operations/;
}

async function apiPost<T>(
  api: APIRequestContext,
  path: string,
  body: Record<string, unknown>,
  token?: string,
): Promise<T> {
  const response = await api.post(path, {
    data: body,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  expect(response.ok(), `${path} failed: ${await response.text()}`).toBe(true);
  return response.json() as Promise<T>;
}

async function apiGet<T>(
  api: APIRequestContext,
  path: string,
  token?: string,
): Promise<T> {
  const response = await api.get(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  expect(response.ok(), `${path} failed: ${await response.text()}`).toBe(true);
  return response.json() as Promise<T>;
}

async function loginByApi(
  api: APIRequestContext,
  role: "customer" | "driver" | "owner",
): Promise<TokenResponse> {
  const path =
    role === "customer"
      ? "/mobile/auth/customer/password"
      : role === "driver"
        ? "/mobile/auth/staff/driver/login"
        : "/mobile/auth/staff/owner/login";
  const identifier =
    role === "customer"
      ? "zhang.wei@example.com"
      : role === "driver"
        ? "mobile.driver1@cleanhub.local"
        : "tenant.admin1@cleanhub.local";

  return apiPost<TokenResponse>(api, path, {
    tenantCode: TENANT_CODE,
    identifier,
    password: PASSWORD,
    deviceId: `playwright-${role}-${Date.now()}`,
  });
}

async function loginPosOwnerByApi(api: APIRequestContext): Promise<void> {
  await apiPost(api, "/auth/login", {
    tenantCode: TENANT_CODE,
    identifier: "tenant.admin1@cleanhub.local",
    password: PASSWORD,
    deviceId: `playwright-pos-owner-${Date.now()}`,
  });
}

async function loginInBrowser(
  page: Page,
  role: "customer" | "driver" | "owner",
): Promise<void> {
  const roleButton =
    role === "customer" ? /客户密码|Customer password/ : role === "driver" ? /配送员|Driver/ : /店主|Owner/;
  const identifier =
    role === "customer"
      ? "zhang.wei@example.com"
      : role === "driver"
        ? "mobile.driver1@cleanhub.local"
        : "tenant.admin1@cleanhub.local";

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());

  await page.getByLabel(/门店代码|Store code/).fill(TENANT_CODE);
  await page.getByRole("button", { name: /继续|Continue/ }).click();
  await page.getByRole("button", { name: roleButton }).click();
  await page.getByLabel(/电话或邮箱|Phone or email/).fill(identifier);
  await page.getByLabel(/密码|Password/).fill(PASSWORD);
  await page.getByRole("button", { name: /登录|Sign in/ }).click();
  await expect(page.getByText(workspaceReadyPattern(role))).toBeVisible({
    timeout: 20_000,
  });
}

async function clickPayAndOpenMockPage(page: Page): Promise<{
  paymentPage: Page;
  openedInPopup: boolean;
}> {
  const popupPromise = page.waitForEvent("popup", { timeout: 5_000 }).catch(() => null);

  await page.getByRole("button", { name: /^(支付|Pay)$/ }).click();

  const popup = await popupPromise;
  const paymentPage = popup ?? page;
  await paymentPage.waitForLoadState("domcontentloaded");
  await expect(paymentPage).toHaveURL(/\/payments\/mock\?/);

  return {
    paymentPage,
    openedInPopup: Boolean(popup),
  };
}

async function firstCustomerOrder(api: APIRequestContext): Promise<{
  token: TokenResponse;
  orderId: string;
  totalAmount: string;
}> {
  const token = await loginByApi(api, "customer");
  const activity = await apiGet<CustomerActivityResponse>(
    api,
    "/mobile/customer/orders",
    token.accessToken,
  );
  const order =
    activity.data.orders.find((item) => item.paymentStatus === "paid") ??
    activity.data.orders[0];

  expect(order, "Seeded customer account must have at least one paid order").toBeTruthy();
  return { token, orderId: order.id, totalAmount: order.totalAmount };
}

async function createPayableCustomerOrder(api: APIRequestContext): Promise<{
  customer: TokenResponse;
  orderId: string;
  totalAmount: string;
}> {
  const [owner, customer] = await Promise.all([
    loginByApi(api, "owner"),
    loginByApi(api, "customer"),
  ]);
  const [branches, profile] = await Promise.all([
    apiGet<OwnerBranchesResponse>(api, "/mobile/owner/branches", owner.accessToken),
    apiGet<CustomerProfileResponse>(api, "/mobile/customer/profile", customer.accessToken),
  ]);
  const branch = branches.data[0];
  const customerId = profile.addresses[0]?.customerId;

  expect(branch, "Owner branch list should not be empty").toBeTruthy();
  expect(customerId, "Customer profile should include a linked customer").toBeTruthy();

  await loginPosOwnerByApi(api);

  const order = await apiPost<PosOrderResponse>(api, "/pos/orders", {
    orderType: "manual",
    branchId: branch.id,
    customerId,
    items: [
      {
        sourceType: "product",
        sourceId: SEEDED_PRODUCT_SOURCE_ID,
        itemName: `Playwright payment item ${Date.now().toString(36)}`,
        quantity: "1",
        unitAmount: "8.25",
      },
    ],
    expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    notes: "Created by Playwright mobile payment E2E",
  });

  expect(order.paymentStatus).toBe("unpaid");
  expect(amountToCents(order.totalAmount)).toBeGreaterThan(0);

  return {
    customer,
    orderId: order.id,
    totalAmount: order.totalAmount,
  };
}

async function createDeliveryTask(api: APIRequestContext): Promise<DeliveryTaskResponse> {
  const uniqueSuffix = Date.now().toString(36);
  const customerName = `Playwright E2E Customer ${uniqueSuffix}`;
  const address = `Playwright E2E pickup address ${uniqueSuffix}`;
  const [driver, owner, customer] = await Promise.all([
    loginByApi(api, "driver"),
    loginByApi(api, "owner"),
    loginByApi(api, "customer"),
  ]);
  const [branches, profile, activity] = await Promise.all([
    apiGet<OwnerBranchesResponse>(api, "/mobile/owner/branches", owner.accessToken),
    apiGet<CustomerProfileResponse>(api, "/mobile/customer/profile", customer.accessToken),
    apiGet<CustomerActivityResponse>(api, "/mobile/customer/orders", customer.accessToken),
  ]);
  const branch = branches.data[0];
  const customerId = profile.addresses[0]?.customerId;
  const order = activity.data.orders[0];
  const ticket = activity.data.tickets[0];

  expect(branch, "Owner branch list should not be empty").toBeTruthy();
  expect(customerId, "Customer profile should include a linked customer").toBeTruthy();
  expect(order, "Customer order fixture should exist").toBeTruthy();
  expect(ticket, "Customer ticket fixture should exist").toBeTruthy();

  return apiPost<DeliveryTaskResponse>(
    api,
    "/mobile/delivery/tasks",
    {
      tenantId: driver.authContext.tenantId,
      branchId: branch.id,
      assigneeUserId: driver.authContext.subjectId,
      customerId,
      type: "pickup",
      customerName,
      customerPhone: "13800000001",
      address,
      orderId: order.id,
      ticketId: ticket.id,
      expectedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      notes: "Created by Playwright mobile-web E2E",
    },
    driver.accessToken,
  );
}

test.describe("mobile web completeness", () => {
  let api: APIRequestContext;

  test.beforeAll(async () => {
    await apiHealth();
    api = await request.newContext({ baseURL: API_BASE_URL });
  });

  test.afterAll(async () => {
    await api.dispose();
  });

  test("customer overview and order detail survive direct URL and refresh", async ({ page }) => {
    const { orderId } = await firstCustomerOrder(api);

    await loginInBrowser(page, "customer");

    await expect(page.getByText(/服务中心|Service center/)).toBeVisible();
    await expect(page.getByText(/下一项|Next up/)).toBeVisible();
    await expect(page.getByText(/进行中|In progress/).first()).toBeVisible();
    await expect(page.getByText(/待取|Ready/).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/XOF|EUR/);

    await page.goto(`/?view=order&id=${orderId}`);
    await expect(page.getByText(new RegExp(orderId.slice(-6).toUpperCase()))).toBeVisible();
    await expect(page.getByText(/总计|Total/).first()).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`view=order.*id=${orderId}|id=${orderId}.*view=order`));

    await page.reload();
    await expect(page.getByText(new RegExp(orderId.slice(-6).toUpperCase()))).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/已付|Paid/).first()).toBeVisible();
  });

  test("customer mock payment returns to a paid order detail", async ({ page }) => {
    const order = await createPayableCustomerOrder(api);

    await loginInBrowser(page, "customer");
    await page.goto(`/?view=order&id=${order.orderId}`);
    await expect(page.getByText(new RegExp(order.orderId.slice(-6).toUpperCase()))).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /^(支付|Pay)$/ })).toBeEnabled();

    const { paymentPage, openedInPopup } = await clickPayAndOpenMockPage(page);
    const paymentId = getPaymentIdFromUrl(paymentPage.url());

    await paymentPage.getByRole("button", { name: /确认支付|Confirm payment/ }).click();
    await expect(paymentPage.getByText(/支付已确认|Payment confirmed/)).toBeVisible();

    if (openedInPopup) {
      await paymentPage.close();
      await page.bringToFront();
    }

    await page.goto(`/?view=order&id=${order.orderId}`);
    await page.reload();

    const paidOrder = await apiGet<CustomerOrderDetailResponse>(
      api,
      `/mobile/customer/orders/${order.orderId}`,
      order.customer.accessToken,
    );
    const paymentStatus = await apiGet<PaymentStatusResponse>(
      api,
      `/mobile/payment/payments/${paymentId}`,
      order.customer.accessToken,
    );

    expect(paymentStatus.transaction.paymentStatus).toBe("paid");
    expect(paidOrder.paymentStatus).toBe("paid");
    expect(amountToCents(paidOrder.paidAmount)).toBe(amountToCents(order.totalAmount));
    await expect(page.getByText(PAID_STATUS_PATTERN).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /^(支付|Pay)$/ })).toBeDisabled();
  });

  test("delivery task detail survives direct URL and refresh", async ({ page }) => {
    const task = await createDeliveryTask(api);

    await loginInBrowser(page, "driver");
    await expect(page.getByText(/路线和客户凭证|Route and customer proofs/)).toBeVisible();

    await page.goto(`/?view=task&id=${task.id}`);
    await expect(page.getByText(task.customerName)).toBeVisible();
    await expect(page.getByText(task.address)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`view=task.*id=${task.id}|id=${task.id}.*view=task`));

    await page.reload();
    await expect(page.getByText(task.customerName)).toBeVisible();
    await expect(page.getByText(task.address)).toBeVisible();
  });

  test("delivery status queues while offline and syncs when online", async ({ page }) => {
    const [driver, task] = await Promise.all([
      loginByApi(api, "driver"),
      createDeliveryTask(api),
    ]);

    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: 31.2304, longitude: 121.4737 });

    await loginInBrowser(page, "driver");
    await page.goto(`/?view=task&id=${task.id}`);
    await expect(page.getByText(task.customerName)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(task.address)).toBeVisible();

    await page.context().setOffline(true);
    await page.getByRole("button", { name: /^(出发|Depart)$/ }).click();
    await expect(page.getByText(PENDING_SYNC_PATTERN).first()).toBeVisible();
    await expect(page.getByText(/在途|En route/).first()).toBeVisible();

    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    await expect
      .poll(async () => {
        const detail = await apiGet<DeliveryTaskDetailResponse>(
          api,
          `/mobile/delivery/tasks/${task.id}`,
          driver.accessToken,
        );

        return detail.status;
      }, { timeout: 20_000 })
      .toBe("en_route");
    await page.reload();
    await expect(page.getByText(PENDING_SYNC_PATTERN)).toHaveCount(0);
  });

  test("owner dispatch filters use branch and driver selectors", async ({ page }) => {
    await loginInBrowser(page, "owner");

    await expect(page.getByText(/今日运营|Today's operations/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/XOF|EUR/);

    const branchSelect = page
      .locator("label")
      .filter({ hasText: /分店|Branch/ })
      .locator("select")
      .first();
    await expect(branchSelect).toBeEnabled();
    await expect.poll(() => branchSelect.locator("option").count()).toBeGreaterThan(1);

    const branchValue = await branchSelect.locator("option").nth(1).getAttribute("value");
    expect(branchValue, "Branch selector should expose a real branch id").toBeTruthy();
    await branchSelect.selectOption(branchValue ?? "");

    const driverSelect = page
      .locator("label")
      .filter({ hasText: /配送员|Driver/ })
      .locator("select")
      .first();
    await expect(driverSelect).toBeEnabled();
    await expect.poll(() => driverSelect.locator("option").count()).toBeGreaterThan(1);
  });
});
