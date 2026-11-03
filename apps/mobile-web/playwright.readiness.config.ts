import { defineConfig, devices } from "@playwright/test";

// Read-only UI regression against the production export. Every API call is
// intercepted in the spec; no live tenant or production database is involved.
export default defineConfig({
  outputDir: "/tmp/cleanhub-customer-readiness-results",
  testDir: "./e2e",
  testMatch: "customer-readiness.spec.ts",
  timeout: 30_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3903",
    viewport: { width: 390, height: 844 },
    locale: "fr-FR",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.MOBILE_TEST_BROWSER_PATH },
  },
  webServer: {
    command: "python3 -m http.server 3903 --bind 127.0.0.1 --directory out",
    url: "http://127.0.0.1:3903",
    reuseExistingServer: !process.env.CI,
  },
});
