import { test, expect, type Page } from "@playwright/test";
import type { MobileAuthContext } from "@cleanhub/api-client";

const tenantId = "01JTEST0000000000000000001",
  subjectId = "01JTEST0000000000000000002";
const orderId = "01JTEST0000000000000000003",
  appointmentId = "01JTEST0000000000000000004";
const now = new Date().toISOString();
const auth: MobileAuthContext = {
  tenantId,
  subjectId,
  subjectType: "customer",
  role: "customer",
  roles: ["customer"],
  branchIds: [],
  permissions: [],
  currency: "XOF",
  country: "SN",
  timezone: "Africa/Dakar",
  deliveryEnabled: true,
  displayName: "Marie",
  mustChangePassword: false,
  accessTokenExpiresAt: "2099-01-01T00:00:00Z",
};
const order = {
  id: orderId,
  orderCode: "POS-TEST-0003",
  customerId: subjectId,
  branchId: tenantId,
  status: "paid",
  paymentStatus: "paid",
  currency: "EUR",
  totalAmount: "18.00",
  paidAmount: "18.00",
  createdAt: now,
  updatedAt: now,
};
const appointment = {
  id: appointmentId,
  tenantId,
  branchId: tenantId,
  customerId: subjectId,
  type: "dropoff",
  status: "accepted",
  expectedAt: now,
  address: "12 rue de Dakar",
  notes: null,
  acceptedAt: now,
  cancelledAt: null,
  doneAt: null,
  createdAt: now,
  updatedAt: now,
  deliveryStatus: "delivering",
};

async function seedSession(page: Page, accountId = subjectId, context = auth) {
  await page.addInitScript(
    ({ auth, accountId }) => {
      const values: Record<string, string> = {
        "cleanhub.mobile.tenantCode": "TEST-UI",
        "cleanhub.mobile.locale": "fr",
        "cleanhub.mobile.accessToken": "ui-only",
        "cleanhub.mobile.refreshToken": "ui-refresh",
        "cleanhub.mobile.accessTokenExpiresAt": "2099-01-01T00:00:00Z",
        "cleanhub.mobile.refreshTokenExpiresAt": "2099-01-01T00:00:00Z",
        "cleanhub.mobile.authContext": JSON.stringify({
          ...auth,
          subjectId: accountId,
        }),
      };
      for (const [key, value] of Object.entries(values))
        localStorage.setItem(`CapacitorStorage.${key}`, value);
    },
    { auth: context, accountId },
  );
}

async function mockApi(
  page: Page,
  options: { offline?: boolean; minimumVersion?: string } = {},
) {
  await page.route("**/mobile/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
        },
      });
    if (
      options.offline &&
      path !== "/mobile/auth/me" &&
      !path.includes("login-options")
    )
      return route.abort("internetdisconnected");
    let body: unknown;
    switch (path) {
      case "/mobile/release-policy":
        body = {
          minimumVersion: options.minimumVersion ?? "0.0.0",
          updateUrl: options.minimumVersion
            ? "https://example.invalid/app"
            : null,
          version: 1,
        };
        break;
      case "/mobile/auth/me":
        body = auth;
        break;
      case "/mobile/auth/customer/login-options":
        body = { customerOtpEnabled: false };
        break;
      case "/mobile/customer/profile":
        body = {
          account: {
            id: subjectId,
            tenantId,
            accountName: "Marie",
            status: "active",
            phone: null,
            email: null,
          },
          addresses: [],
        };
        break;
      case "/mobile/customer/addresses":
      case "/mobile/customer/branches":
      case "/mobile/payment/refund-requests":
        body = { data: [] };
        break;
      case "/mobile/customer/orders":
        body = { data: { orders: [order], tickets: [], nextOffset: null } };
        break;
      case "/mobile/customer/appointments":
        body = { data: [appointment] };
        break;
      case `/mobile/customer/orders/${orderId}`:
        body = {
          ...order,
          orderType: "manual",
          branchName: "Dakar test store",
          notes: null,
          subtotalAmount: "15.00",
          taxableAmount: "15.00",
          taxAmount: "3.00",
          taxRateSnapshot: "20.00",
          taxLabelSnapshot: "TVA",
          taxRegistrationNumberSnapshot: "TEST-TAX",
          taxExemptionReason: null,
          taxComponentsSnapshot: [],
          items: [],
        };
        break;
      case `/mobile/customer/appointments/${appointmentId}`:
        body = {
          ...appointment,
          ticketId: null,
          taskId: orderId,
          signedAt: null,
          cancellationReason: null,
          events: [{ status: "delivering", occurredAt: now }],
        };
        break;
      default:
        throw new Error(
          `Unexpected API request in read-only UI test: ${request.method()} ${path}`,
        );
    }
    return route.fulfill({
      json: body,
      headers: { "access-control-allow-origin": "*" },
    });
  });
}

test("French order detail uses historical currency and cached detail works offline", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await seedSession(page);
  await mockApi(page);
  await page.goto(`/?view=order&id=${orderId}`);
  await expect(page.getByRole("dialog")).toContainText("POS-TEST-0003");
  await expect(page.getByRole("dialog")).toContainText("€");
  await expect(page.getByRole("dialog")).toContainText("TVA");
  await expect(page.getByRole("dialog")).toContainText("TEST-TAX");
  await expect(page.getByRole("dialog")).toContainText("Dakar test store");
  await expect(page.getByRole("dialog")).not.toContainText("manual");
  await page.unroute("**/mobile/**");
  await mockApi(page, { offline: true });
  await page.reload();
  await expect(page.getByRole("dialog")).toContainText("POS-TEST-0003");
  await expect(page.getByRole("dialog")).toContainText("€");
  expect(errors).toEqual([]);
});

test("appointment push destination opens customer tracking, including offline", async ({
  page,
}) => {
  await seedSession(page);
  await mockApi(page);
  await page.goto(`/?view=appointment&id=${appointmentId}`);
  await expect(page.getByRole("dialog")).toContainText("12 rue de Dakar");
  await expect(page.getByRole("dialog")).not.toContainText("delivering");
  await page.screenshot({
    path: "/tmp/cleanhub-customer-tracking-fr.png",
    fullPage: true,
  });
  await page.unroute("**/mobile/**");
  await mockApi(page, { offline: true });
  await page.reload();
  await expect(page.getByRole("dialog")).toContainText("12 rue de Dakar");
  await expect(page.getByRole("dialog")).toContainText(
    "dernière synchronisation",
  );
});

test("remote minimum version blocks the old bundle without rebuilding", async ({
  page,
}) => {
  await seedSession(page);
  await mockApi(page, { minimumVersion: "999.0.0" });
  await page.goto("/");
  const install = page.getByRole("link", { name: /Mettre|Installer/i });
  await expect(install).toHaveAttribute("href", "https://example.invalid/app");
});

test("a transient refresh failure preserves credentials and cached customer history", async ({
  page,
}) => {
  await seedSession(page);
  await mockApi(page);
  await page.goto(`/?view=order&id=${orderId}`);
  await expect(page.getByRole("dialog")).toContainText("POS-TEST-0003");
  await page.route("**/mobile/auth/me", (route) =>
    route.fulfill({
      status: 401,
      json: { code: "TOKEN_EXPIRED", message: "Expired" },
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.route("**/mobile/auth/refresh", (route) =>
    route.abort("internetdisconnected"),
  );
  await page.reload();
  await expect(page.getByRole("dialog")).toContainText("POS-TEST-0003");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("CapacitorStorage.cleanhub.mobile.refreshToken"),
    ),
  ).toBe("ui-refresh");
});

test("another driver cannot read or replay previous account caches and queues", async ({
  page,
}) => {
  const driver: MobileAuthContext = {
    ...auth,
    subjectId: "01JTEST0000000000000000009",
    subjectType: "staff",
    role: "driver",
    roles: ["driver"],
    branchIds: [tenantId],
    displayName: "Driver B",
  };
  await seedSession(page, driver.subjectId, driver);
  await page.addInitScript(
    ({ tenantId, previousId, now }) => {
      const task = {
        id: "private-task-A",
        customerName: "Private customer of driver A",
        address: "Private address A",
      };
      const cache = { loadedAt: now, tasks: [task], details: {} };
      const queue = [
        {
          id: "queue-A",
          entity: "delivery-task",
          operation: "update",
          status: "pending",
          attempt: 0,
          createdAt: now,
          updatedAt: now,
          idempotencyKey: "queue-A",
          payload: {
            kind: "status",
            taskId: task.id,
            request: { toStatus: "arrived", idempotencyKey: "queue-A" },
          },
        },
      ];
      // Both legacy global keys and the first driver's new scoped keys exist.
      for (const prefix of ["", `${tenantId}:${previousId}:`]) {
        localStorage.setItem(
          `CapacitorStorage.${prefix}cleanhub.mobile.delivery.tasks.v1`,
          JSON.stringify(cache),
        );
        localStorage.setItem(
          `CapacitorStorage.${prefix}cleanhub.mobile.delivery.queue.v1`,
          JSON.stringify(queue),
        );
      }
    },
    { tenantId, previousId: subjectId, now },
  );
  const mutations: string[] = [];
  await mockApi(page);
  await page.route("**/mobile/auth/me", (route) =>
    route.fulfill({
      json: driver,
      headers: { "access-control-allow-origin": "*" },
    }),
  );
  await page.route("**/mobile/delivery/**", (route) => {
    if (
      route.request().method() !== "GET" &&
      route.request().method() !== "OPTIONS"
    )
      mutations.push(route.request().url());
    return route.abort("internetdisconnected");
  });
  await page.goto("/");
  await expect(page.getByText("Driver B").first()).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText("0 action(s) synchronisée(s).")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "Private customer of driver A",
  );
  await expect(page.locator("body")).not.toContainText("Private address A");
  expect(mutations).toEqual([]);
});

test("pending offline logouts retry after reconnect without restoring a signed-out credential", async ({
  page,
}) => {
  await seedSession(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "CapacitorStorage.cleanhub.mobile.pending-logouts.v1",
      JSON.stringify([
        {
          refreshToken: "revocation-only",
          deviceId: "previous-device",
          expiresAt: "2099-01-01T00:00:00Z",
        },
      ]),
    ),
  );
  await mockApi(page);
  let offline = true,
    attempts = 0;
  await page.route("**/mobile/auth/logout", async (route) => {
    attempts++;
    expect(route.request().postDataJSON().refreshToken).toBe("revocation-only");
    if (offline) return route.abort("internetdisconnected");
    return route.fulfill({
      json: { loggedOut: true },
      headers: { "access-control-allow-origin": "*" },
    });
  });
  await page.goto("/");
  await expect.poll(() => attempts).toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(
            localStorage.getItem(
              "CapacitorStorage.cleanhub.mobile.pending-logouts.v1",
            ) ?? "[]",
          ).length,
      ),
    )
    .toBe(1);
  offline = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem(
          "CapacitorStorage.cleanhub.mobile.pending-logouts.v1",
        ),
      ),
    )
    .toBeNull();
  expect(
    await page.evaluate(() =>
      localStorage.getItem("CapacitorStorage.cleanhub.mobile.refreshToken"),
    ),
  ).toBe("ui-refresh");
});
