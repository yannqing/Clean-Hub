import { serve } from "@hono/node-server";
import {
  assertTenantRlsConfiguration,
  closeDbConnection,
  inspectTenantRlsConfiguration,
  warmUpDbConnection,
} from "@cleanhub/db";

import { createApiApp } from "./app.js";

export async function startApiServer() {
  const { app, env, logger } = createApiApp();

  try {
    await warmUpDbConnection();
    logger.info("Database connection pool warmed up");
  } catch (error) {
    logger.warn(
      { err: error },
      "Database warm-up failed; starting API without a warm pool",
    );
  }

  try {
    const rls = env.databaseRequireRls
      ? await assertTenantRlsConfiguration()
      : await inspectTenantRlsConfiguration();

    if (rls.ready) {
      logger.info(
        {
          databaseRole: rls.role.name,
          protectedTableCount: rls.protectedTableCount,
        },
        "Tenant row-level security verified",
      );
    } else {
      logger.warn(
        {
          databaseRole: rls.role,
          missingForcedRlsTables: rls.missingForcedRlsTables,
          missingPolicyTables: rls.missingPolicyTables,
        },
        "Tenant row-level security is not enforced for this development database",
      );
    }
  } catch (error) {
    if (env.databaseRequireRls) {
      throw error;
    }

    logger.warn(
      { err: error },
      "Tenant row-level security inspection failed in development",
    );
  }

  const server = serve({
    fetch: app.fetch,
    port: env.port,
  });

  logger.info({ port: env.port }, "CleanHub API listening");

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    logger.info({ signal }, "CleanHub API shutting down");

    server.close(async () => {
      await closeDbConnection();
      logger.info({ signal }, "CleanHub API stopped");
      process.exit(0);
    });
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return server;
}
