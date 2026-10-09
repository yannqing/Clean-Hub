import type { CapacitorConfig } from "@capacitor/cli";

const devServerUrl =
  process.env.CLEANHUB_MOBILE_DEV_SERVER_URL ?? process.env.CAPACITOR_DEV_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.cleanhub.app",
  appName: "CleanHub",
  webDir: "../mobile-web/out",
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
