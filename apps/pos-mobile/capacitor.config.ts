/// <reference types="@capacitor/splash-screen" />
/// <reference types="@capacitor/status-bar" />

import type { CapacitorConfig } from "@capacitor/cli";
import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

type PosRuntimeConfig = {
  runtimeMode: "development" | "production";
  isProduction: boolean;
  allowCleartext: boolean;
  serverUrl?: string;
};

const { resolvePosRuntimeConfig } = require("./scripts/runtime-config.cjs") as {
  resolvePosRuntimeConfig: (
    environment: NodeJS.ProcessEnv,
  ) => PosRuntimeConfig;
};

/**
 * CleanHub POS is a native shell around the server-rendered pos-web app.
 * pos-web relies on Next.js proxy/middleware, Server Components and HttpOnly
 * cookies, so it cannot be exported into `www/` as a static production app.
 *
 * Development uses a LAN-accessible URL. Production uses the hosted HTTPS POS
 * origin; that origin must also reverse-proxy API requests under the same host
 * so Next.js and the WebView receive the same host-only auth cookies.
 */
loadEnv({ path: resolve(__dirname, ".env"), quiet: true });

const { isProduction, allowCleartext, serverUrl } =
  resolvePosRuntimeConfig(process.env);

const config: CapacitorConfig = {
  appId: "com.cleanhub.pos",
  appName: "CleanHub POS",
  webDir: "www",
  appendUserAgent: " CleanHubPOS/0.1",
  backgroundColor: "#000000",
  loggingBehavior: isProduction ? "none" : "debug",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http:"),
          androidScheme: "https",
          errorPath: "index.html",
        },
      }
    : {}),
  ios: {
    allowsLinkPreview: false,
    contentInset: "never",
    preferredContentMode: "desktop",
    webContentsDebuggingEnabled: !isProduction,
  },
  android: {
    allowMixedContent: allowCleartext,
    webContentsDebuggingEnabled: !isProduction,
  },
  plugins: {
    CapacitorCookies: {
      enabled: true,
    },
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 800,
      backgroundColor: "#000000",
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: "LIGHT",
      backgroundColor: "#000000",
    },
  },
};

export default config;
