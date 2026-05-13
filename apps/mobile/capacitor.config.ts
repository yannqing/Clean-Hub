import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cleanhub.app",
  appName: "CleanHub",
  webDir: "www",
  server: {
    url: "http://localhost:3001",
    cleartext: true
  }
};

export default config;
