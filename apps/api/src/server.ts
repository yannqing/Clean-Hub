import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import {
  assertTenantRlsConfiguration,
  closeDbConnection,
  inspectTenantRlsConfiguration,
  warmUpDbConnection,
} from "@cleanhub/db";

import { createApiApp } from "./app.js";

export async function startApiServer() {
  const { app, env, logger, realtimeHub } = createApiApp();

  try {
    await warmUpDbConnection();
    realtimeHub.markServiceHealthy();
    logger.info("Database connection pool warmed up");
  } catch (error) {
    realtimeHub.markServiceDegraded();
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
      realtimeHub.markServiceHealthy();
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

  const webSocketServer = new WebSocketServer({
    clientTracking: true,
    maxPayload: 16_384,
    noServer: true,
    perMessageDeflate: false,
  });
  const server = serve({
    fetch: app.fetch,
    port: env.port,
    websocket: { server: webSocketServer },
  });
  realtimeHub.start();

  logger.info({ port: env.port }, "CleanHub API listening");

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    logger.info({ signal }, "CleanHub API shutting down");
    await realtimeHub.stop();

    server.close(async () => {
      webSocketServer.close();
      await closeDbConnection();
      logger.info({ signal }, "CleanHub API stopped");
      process.exit(0);
    });
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return server;
}
