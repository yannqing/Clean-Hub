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
    options?: { allowMissingServer?: boolean },
  ) => PosRuntimeConfig;
};

/**
 * iOS remains a shell around the server-rendered pos-web app. Android starts
 * its Compose `MainActivity` directly; its API origin is compiled into the
 * Android BuildConfig and Capacitor's `server` field is omitted for Android
 * native-only packaging.
 *
 * The server URL remains for iOS and development of the legacy shell.
 */
loadEnv({ path: resolve(__dirname, ".env"), quiet: true });

const nativeAndroidBuild = process.env.CLEANHUB_POS_NATIVE_ANDROID === "true";
// A native Android package drops Capacitor's `server` field entirely and
// compiles its API origin into BuildConfig, so the pos-web origin is not just
// unused -- requiring it would fail an Android-only release for the sake of a
// value nothing reads. iOS, still a WebView shell, keeps needing it.
const { isProduction, allowCleartext, serverUrl } = resolvePosRuntimeConfig(
  nativeAndroidBuild
    ? { ...process.env, CLEANHUB_POS_SERVER_URL: undefined }
    : process.env,
  { allowMissingServer: nativeAndroidBuild },
);

const config: CapacitorConfig = {
  appId: "com.cleanhub.pos",
  appName: "CleanHub POS",
  webDir: "www",
  appendUserAgent: " CleanHubPOS/0.1",
  backgroundColor: "#000000",
  loggingBehavior: isProduction ? "none" : "debug",
  ...(!nativeAndroidBuild && serverUrl
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
