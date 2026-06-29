import { serve } from "@hono/node-server";
import { closeDbConnection, warmUpDbConnection } from "@cleanhub/db";

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
