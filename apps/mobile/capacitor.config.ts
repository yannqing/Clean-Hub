import type { CapacitorConfig } from "@capacitor/cli";

const devServerUrl =
  process.env.CLEANHUB_MOBILE_DEV_SERVER_URL ?? process.env.CAPACITOR_DEV_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.cleanhub.app",
  appName: "CleanHub",
  webDir: "../mobile-web/out",
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
