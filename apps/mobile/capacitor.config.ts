import type { CapacitorConfig } from "@capacitor/cli";

const devServerUrl =
  process.env.CLEANHUB_MOBILE_DEV_SERVER_URL ??
  process.env.CAPACITOR_DEV_SERVER_URL;
const production = process.env.CLEANHUB_MOBILE_ENV === "prod";

if (production && devServerUrl) {
  throw new Error(
    "A production customer app must load its bundled UI; remove the development server URL.",
  );
}

const config: CapacitorConfig = {
  appId: "com.cleanhub.app",
  appName: "CleanHub",
  webDir: "../mobile-web/out",
  ...(production
    ? {
        loggingBehavior: "none" as const,
        android: {
          webContentsDebuggingEnabled: false,
          allowMixedContent: false,
        },
        ios: { webContentsDebuggingEnabled: false },
      }
    : {}),
  plugins: {
    FirebaseMessaging: {
      presentationOptions: ["alert", "badge", "sound"],
    },
  },
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          "@capacitor-firebase/messaging": {
            symlink: true,
          },
        },
      },
    },
  },
  ...(devServerUrl
    ? {
        server: {
          url: devServerUrl,
          cleartext: devServerUrl.startsWith("http://"),
        },
      }
    : {}),
};

export default config;
