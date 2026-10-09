import { createLogger } from "@cleanhub/logger";
import { runWithSystemDatabaseContext } from "@cleanhub/db";

import { purgeElapsedTenants } from "../modules/saas/tenants/tenants.repository.js";
import { scheduleNonOverlapping } from "./schedule.js";

const logger = createLogger({
  name: "tenant-purge",
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

/**
 * Soft-delete tenants whose retention window has elapsed.
 *
 * This marks `deleted_at`; it does not drop rows. Physical removal of ~90
 * tenant-scoped tables is a separate, deliberate operation — a cron job that
 * silently destroys data is not something to run unattended.
 */
export async function runTenantPurgeOnce(): Promise<void> {
  await runWithSystemDatabaseContext(async () => {
    const batchSize = readPositiveInteger(
      process.env.TENANT_PURGE_BATCH_SIZE,
      50,
    );
    const purged = await purgeElapsedTenants({ limit: batchSize });

    if (purged.length > 0) {
      logger.info(
        { purgedCount: purged.length, tenantIds: purged },
        "Tenant retention windows elapsed",
      );
      return;
    }

    logger.debug("No tenant retention windows elapsed");
  });
}

/**
 * Start the cron loop: run once now, then on its interval.
 *
 * Exported so the packaged release can start it without relying on the
 * `process.argv[1]` check below, which only matches when this file is run
 * directly as TypeScript and is false in the bundled output.
 */
export async function startTenantPurgeCron(): Promise<void> {
  if (isDisabled(process.env.TENANT_PURGE_DISABLED)) {
    logger.info("Tenant purge cron disabled");
    return;
  }

  const intervalSeconds = readPositiveInteger(
    process.env.TENANT_PURGE_INTERVAL_SECONDS,
    60 * 60,
  );

  await runTenantPurgeOnce();

  scheduleNonOverlapping(
    intervalSeconds * 1000,
    runTenantPurgeOnce,
    (error: unknown) => {
      logger.error({ error }, "Tenant purge failed");
    },
    () => {
      logger.warn("Tenant purge still running; skipping this tick");
    },
  );
}

if (process.argv[1]?.endsWith("tenant-purge.ts")) {
  startTenantPurgeCron().catch((error: unknown) => {
    logger.error({ error }, "Tenant purge crashed");
    process.exitCode = 1;
  });
}
