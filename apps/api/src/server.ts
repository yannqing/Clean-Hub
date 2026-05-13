import { serve } from "@hono/node-server";
import { closeDbConnection } from "@cleanhub/db";

import { createApiApp } from "./app.js";

export function startApiServer() {
  const { app, env, logger } = createApiApp();

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
