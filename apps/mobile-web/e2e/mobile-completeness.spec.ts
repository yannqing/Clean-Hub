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
    orders: Array<{ id: string; totalAmount: string }>;
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

async function apiHealth(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/health`);

  expect(response.status, `API health at ${API_BASE_URL}/health`).toBe(200);
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
  const order = activity.data.orders[0];

  expect(order, "Seeded customer account must have at least one order").toBeTruthy();
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
    await expect(page.getByText(new RegExp(orderId.slice(-6).toUpperCase()))).toBeVisible();
    await expect(page.getByText(/已付|Paid/).first()).toBeVisible();
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
