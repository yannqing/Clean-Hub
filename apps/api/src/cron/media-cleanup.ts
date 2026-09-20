import { createLogger } from "@cleanhub/logger";
import { runWithSystemDatabaseContext } from "@cleanhub/db";

import { MediaService } from "../modules/media/index.js";
import { scheduleNonOverlapping } from "./schedule.js";

const logger = createLogger({
  name: "media-cleanup",
  service: "cleanhub-api",
});

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

function isDisabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(value?.trim().toLowerCase() ?? "");
}

export async function runMediaCleanupOnce(
  service = new MediaService(),
): Promise<void> {
  await runWithSystemDatabaseContext(async () => {
    const batchSize = readPositiveInteger(
      process.env.MEDIA_CLEANUP_BATCH_SIZE,
      100,
    );
    const result = await service.cleanupExpiredPending({
      limit: batchSize,
    });

    logger.info(result, "Media cleanup completed");
  });
}

/**
 * Start the cron loop: run once now, then on its interval.
 *
 * Exported so the packaged release can start it without relying on the
 * `process.argv[1]` check below, which only matches when this file is run
 * directly as TypeScript and is false in the bundled output.
 */
export async function startMediaCleanupCron(): Promise<void> {
  if (isDisabled(process.env.MEDIA_CLEANUP_DISABLED)) {
    logger.info("Media cleanup cron disabled");
    return;
  }

  const intervalSeconds = readPositiveInteger(
    process.env.MEDIA_CLEANUP_INTERVAL_SECONDS,
    15 * 60,
  );

  await runMediaCleanupOnce();

  scheduleNonOverlapping(
    intervalSeconds * 1000,
    runMediaCleanupOnce,
    (error: unknown) => {
      logger.error({ error }, "Media cleanup failed");
    },
    () => {
      logger.warn("Media cleanup still running; skipping this tick");
    },
  );
}

if (process.argv[1]?.endsWith("media-cleanup.ts")) {
  startMediaCleanupCron().catch((error: unknown) => {
    logger.error({ error }, "Media cleanup crashed");
    process.exitCode = 1;
  });
}
