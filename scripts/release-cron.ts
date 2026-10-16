import { logger } from "../packages/logger/src/index.js";

import { startEmailDeliveryCron } from "../apps/api/src/cron/email-delivery.js";
import { startMediaCleanupCron } from "../apps/api/src/cron/media-cleanup.js";
import { startTenantPurgeCron } from "../apps/api/src/cron/tenant-purge.js";

/**
 * Background jobs for the packaged release.
 *
 * All three run in one container rather than three: each is a timer that is
 * idle almost all the time, they share a database pool, and a single process is
 * one less thing to forget in the compose file. That was the failure mode this
 * entry point exists to fix -- the crons had no service at all, so notifications
 * were enqueued and never sent.
 *
 * Each job is started independently and honours its own `*_DISABLED` and
 * `*_INTERVAL_SECONDS` variables, so an operator can turn one off without
 * touching the others. A job that fails to start is logged and the others carry
 * on: losing media cleanup should not also stop notifications going out.
 */
const jobs = [
  { name: "email-delivery", start: startEmailDeliveryCron },
  { name: "media-cleanup", start: startMediaCleanupCron },
  { name: "tenant-purge", start: startTenantPurgeCron },
];

async function main(): Promise<void> {
  const results = await Promise.allSettled(
    jobs.map(async (job) => {
      await job.start();
      return job.name;
    }),
  );

  const failed = results.flatMap((result, index) =>
    result.status === "rejected"
      ? [{ job: jobs[index]!.name, error: result.reason as unknown }]
      : [],
  );

  for (const failure of failed) {
    // `err`, not `error`: Pino's standard serializer only unpacks the former,
    // so an Error logged as `error` arrives as an empty object and the reason
    // the job died is lost.
    logger.error(
      { err: failure.error, job: failure.job },
      "Background job failed to start",
    );
  }

  if (failed.length === jobs.length) {
    // Nothing is running, so the container has no reason to stay up. Exiting
    // non-zero lets the restart policy retry instead of leaving a process that
    // looks healthy and does nothing.
    throw new Error("No background job could be started.");
  }

  logger.info(
    {
      started: results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      ),
    },
    "Background jobs started",
  );
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "Background jobs crashed");
  process.exitCode = 1;
});
