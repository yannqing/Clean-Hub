import { createLogger } from "@cleanhub/logger";
import { runWithSystemDatabaseContext } from "@cleanhub/db";

import { NotificationsService } from "../modules/notifications/index.js";

const logger = createLogger({
  name: "email-delivery",
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

export async function runEmailDeliveryOnce(
  service = new NotificationsService(),
): Promise<void> {
  await runWithSystemDatabaseContext(async () => {
    const batchSize = readPositiveInteger(
      process.env.EMAIL_DELIVERY_BATCH_SIZE,
      50,
    );
    const pushBatchSize = readPositiveInteger(
      process.env.PUSH_DELIVERY_BATCH_SIZE,
      50,
    );
    const overdueBatchSize = readPositiveInteger(
      process.env.EMAIL_OVERDUE_TICKET_BATCH_SIZE,
      100,
    );
    const [overdueResult, deliveryResult, pushResult] = await Promise.all([
      isDisabled(process.env.EMAIL_OVERDUE_TICKET_DISABLED)
        ? Promise.resolve(null)
        : service.publishOverdueTicketEvents({ limit: overdueBatchSize }),
      service.processEmailDeliveries({ limit: batchSize }),
      isDisabled(process.env.PUSH_DELIVERY_DISABLED)
        ? Promise.resolve(null)
        : service.processPushDeliveries({ limit: pushBatchSize }),
    ]);

    logger.info(
      {
        overdue: overdueResult,
        deliveries: deliveryResult,
        pushDeliveries: pushResult,
      },
      "Notification delivery cron completed",
    );
  });
}

async function main(): Promise<void> {
  if (isDisabled(process.env.EMAIL_DELIVERY_DISABLED)) {
    logger.info("Email delivery cron disabled");
    return;
  }

  const intervalSeconds = readPositiveInteger(
    process.env.EMAIL_DELIVERY_INTERVAL_SECONDS,
    60,
  );

  await runEmailDeliveryOnce();

  setInterval(() => {
    runEmailDeliveryOnce().catch((error: unknown) => {
      logger.error({ error }, "Email delivery cron failed");
    });
  }, intervalSeconds * 1000);
}

if (process.argv[1]?.endsWith("email-delivery.ts")) {
  main().catch((error: unknown) => {
    logger.error({ error }, "Email delivery cron crashed");
    process.exitCode = 1;
  });
}
