import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const isDevelopment = process.env.NODE_ENV === "development";
const allowedDevOrigins = (process.env.POS_ALLOWED_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: "standalone",
  ...(isDevelopment && allowedDevOrigins.length > 0
    ? { allowedDevOrigins }
    : {}),
  ...(isDevelopment ? {} : { outputFileTracingRoot: join(currentDir, "../..") }),
};

export default nextConfig;
