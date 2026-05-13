import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

import * as schema from "./schema.js";

export type Database = NodePgDatabase<typeof schema>;

export type DbConnection = {
  db: Database;
  pool: Pool;
};

export type DbPoolOptions = {
  databaseUrl: string;
  poolConfig?: Omit<PoolConfig, "connectionString">;
  onPoolError?: (error: Error) => void;
};

const DEFAULT_POOL_MAX = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_QUERY_TIMEOUT_MS = 30_000;
const DEFAULT_KEEP_ALIVE_INITIAL_DELAY_MS = 10_000;

declare global {
  var __cleanHubDbConnection: DbConnection | undefined;
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to initialize @cleanhub/db.");
  }

  return databaseUrl;
}

export function getDefaultPoolConfig(
  env: NodeJS.ProcessEnv = process.env,
): Omit<PoolConfig, "connectionString"> {
  return {
    max: readPositiveInteger(env.DATABASE_POOL_MAX, DEFAULT_POOL_MAX),
    idleTimeoutMillis: readPositiveInteger(
      env.DATABASE_POOL_IDLE_TIMEOUT_MS,
      DEFAULT_IDLE_TIMEOUT_MS,
    ),
    connectionTimeoutMillis: readPositiveInteger(
      env.DATABASE_POOL_CONNECTION_TIMEOUT_MS,
      DEFAULT_CONNECTION_TIMEOUT_MS,
    ),
    query_timeout: readPositiveInteger(
      env.DATABASE_POOL_QUERY_TIMEOUT_MS,
      DEFAULT_QUERY_TIMEOUT_MS,
    ),
    keepAlive: true,
    keepAliveInitialDelayMillis: readPositiveInteger(
      env.DATABASE_POOL_KEEP_ALIVE_INITIAL_DELAY_MS,
      DEFAULT_KEEP_ALIVE_INITIAL_DELAY_MS,
    ),
    application_name: env.DATABASE_APPLICATION_NAME ?? "cleanhub",
  };
}

export function createDbPool({
  databaseUrl,
  poolConfig,
  onPoolError,
}: DbPoolOptions): Pool {
  const pool = new Pool({
    ...getDefaultPoolConfig(),
    ...poolConfig,
    connectionString: databaseUrl,
  });

  pool.on("error", (error) => {
    onPoolError?.(error);
  });

  return pool;
}

export function createDbConnection(options: DbPoolOptions): DbConnection {
  const pool = createDbPool(options);
  const db = drizzle(pool, { schema });

  return {
    db,
    pool,
  };
}

export function createDbClient(
  databaseUrl: string,
  poolConfig?: Omit<PoolConfig, "connectionString">,
): Database {
  return createDbConnection({ databaseUrl, poolConfig }).db;
}

export function getDbConnection(): DbConnection {
  if (!globalThis.__cleanHubDbConnection) {
    globalThis.__cleanHubDbConnection = createDbConnection({
      databaseUrl: getDatabaseUrl(),
      onPoolError: (error) => {
        console.error("[db] Unexpected error on idle PostgreSQL client", error);
      },
    });
  }

  return globalThis.__cleanHubDbConnection;
}

export function getDb(): Database {
  return getDbConnection().db;
}

export async function closeDbConnection(): Promise<void> {
  if (!globalThis.__cleanHubDbConnection) {
    return;
  }

  await globalThis.__cleanHubDbConnection.pool.end();
  globalThis.__cleanHubDbConnection = undefined;
}
