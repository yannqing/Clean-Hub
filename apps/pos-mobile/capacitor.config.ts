import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for CleanHub POS mobile app.
 *
 * Development mode:
 *   The `server.url` points to pos-web's dev server (port 3001).
 *   Make sure your phone and computer are on the same network.
 *   On Android, replace "localhost" with your computer's LAN IP if needed.
 *
 * Production mode:
 *   Remove (or comment out) the `server.url` line.
 *   Capacitor will load static files from the `www/` directory.
 */
const config: CapacitorConfig = {
  appId: "com.cleanhub.pos",
  appName: "CleanHub POS",
  webDir: "www",
  server: {
    // Development: live reload from pos-web dev server.
    url: "http://localhost:3001",
    cleartext: true,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
