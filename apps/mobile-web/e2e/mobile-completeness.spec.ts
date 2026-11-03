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

const PENDING_SYNC_PATTERN =
  /1 pending sync|1 to sync|1 个操作待同步|1 个待同步/i;

async function apiHealth(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/health`);

  expect(response.status, `API health at ${API_BASE_URL}/health`).toBe(200);
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

  test("customer order detail is read-only for payment and mock routes are absent", async ({ page }) => {
    const { token, orderId } = await firstCustomerOrder(api);
    await loginInBrowser(page, "customer");
    await page.goto(`/?view=order&id=${orderId}`);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: /^(支付|Pay)$/ })).toHaveCount(0);
    for (const path of [`/mobile/payment/orders/${orderId}/payments`, `/mobile/payment/payments/${orderId}/mock-callback`]) {
      const response = await api.post(`${API_BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${token.accessToken}`, "X-CleanHub-Auth-Client": "mobile" }, data: {},
      });
      expect(response.status()).toBe(404);
    }
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
    await page.getByRole("tab", { name: /派单|Dispatch/ }).click();

    const branchSelector = page.getByRole("button", { name: /^(分店|Branch)$/ });
    await expect(branchSelector).toBeEnabled();
    await branchSelector.click();

    const branchOptions = page.getByRole("radio");
    await expect.poll(() => branchOptions.count()).toBeGreaterThan(1);
    await branchOptions.nth(1).click();

    const driverSelector = page.getByRole("button", { name: /^(配送员|Driver)$/ });
    await expect(driverSelector).toBeEnabled();
    await driverSelector.click();
    await expect.poll(() => page.getByRole("radio").count()).toBeGreaterThan(1);
  });
});
