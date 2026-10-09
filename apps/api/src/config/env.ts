import { resolve } from "node:path";

import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../../.env") });

export type ApiEnv = {
  port: number;
  corsOrigins: string[];
  mobileNativeOrigins: string[];
  corsEnforceSameOrigin: boolean;
  databaseRequireRls: boolean;
  nodeEnv: string;
};

function readPort(value: string | undefined): number {
  if (!value) {
    return 4000;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 4000;
}

function readCorsOrigins(value: string | undefined): string[] {
  if (!value) {
    return ["http://localhost:3000"];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function readBoolean(
  value: string | undefined,
  fallback: boolean,
  name: string,
): boolean {
  if (value === undefined || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`${name} must be either "true" or "false".`);
}

export function loadApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  const nodeEnv = env.NODE_ENV ?? "development";
  return {
    port: readPort(env.PORT),
    corsOrigins: readCorsOrigins(env.CORS_ORIGINS),
    mobileNativeOrigins: readCorsOrigins(
      env.MOBILE_NATIVE_ORIGINS ?? "https://localhost",
    ),
    corsEnforceSameOrigin: readBoolean(
      env.CORS_ENFORCE_SAME_ORIGIN,
      nodeEnv === "production",
      "CORS_ENFORCE_SAME_ORIGIN",
    ),
    databaseRequireRls: readBoolean(
      env.DATABASE_REQUIRE_RLS,
      nodeEnv === "production",
      "DATABASE_REQUIRE_RLS",
    ),
    nodeEnv,
  };
}
