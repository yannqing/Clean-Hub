import { defineConfig, devices } from "@playwright/test";

const port = Number.parseInt(process.env.MOBILE_WEB_E2E_PORT ?? "3002", 10);
const baseURL = `http://localhost:${Number.isFinite(port) ? port : 3002}`;
const apiBaseURL = process.env.MOBILE_WEB_E2E_API_BASE_URL ?? "http://localhost:4100";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    locale: "en-US",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @cleanhub/api dev",
      env: {
        CORS_ORIGINS: baseURL,
        MOBILE_AUTH_TEST_OTP_ENABLED: "true",
        NEXT_PUBLIC_API_BASE_URL: apiBaseURL,
        PORT: apiBaseURL.split(":").at(-1) ?? "4100",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: `${apiBaseURL}/health`,
    },
    {
      command: "pnpm dev",
      env: {
        NEXT_PUBLIC_API_BASE_URL: apiBaseURL,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: baseURL,
    },
  ],
});
