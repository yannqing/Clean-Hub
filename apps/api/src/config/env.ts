import { resolve } from "node:path";

import { config } from "dotenv";

config({ path: resolve(process.cwd(), "../../.env") });

export type ApiEnv = {
  port: number;
  corsOrigins: string[];
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

export function loadApiEnv(env: NodeJS.ProcessEnv = process.env): ApiEnv {
  return {
    port: readPort(env.PORT),
    corsOrigins: readCorsOrigins(env.CORS_ORIGINS),
    nodeEnv: env.NODE_ENV ?? "development",
  };
}
