import { resolve } from "node:path";

import { config } from "dotenv";
import { eq, getTableColumns, like } from "drizzle-orm";

import {
  closeDbConnection,
  getDb,
  deliveryProofs,
  mediaObjects,
  runWithSystemDatabaseContext,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import {
  buildTenantObjectKey,
  ObjectStorage,
  getExtensionForContentType,
  loadStorageConfig,
} from "@cleanhub/storage";

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/;

config({ path: resolve(process.cwd(), "../../.env") });

type BackfillOptions = {
  batchSize: number;
  limit: number;
  dryRun: boolean;
};

function readOptions(): BackfillOptions {
  return {
    batchSize: readPositiveInteger(process.env.MEDIA_BACKFILL_BATCH_SIZE, 50),
    limit: readPositiveInteger(process.env.MEDIA_BACKFILL_LIMIT, 500),
    dryRun: ["1", "true", "yes"].includes(
      process.env.MEDIA_BACKFILL_DRY_RUN?.toLowerCase() ?? "",
    ),
  };
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

function parseDataUrl(value: string): {
  contentType: string;
  bytes: Buffer;
} | null {
  const match = value.match(DATA_URL_PATTERN);

  if (!match?.[1] || !match[2]) {
    return null;
  }

  return {
    contentType: match[1],
    bytes: Buffer.from(match[2], "base64"),
  };
}

async function runBackfill(): Promise<void> {
  const db = getDb();
  const options = readOptions();
  const storageConfig = loadStorageConfig();
  const storage = new ObjectStorage(storageConfig);
  let processed = 0;
  let migrated = 0;
  let skipped = 0;

  while (processed < options.limit) {
    const rows = await db
      .select({ ...getTableColumns(deliveryProofs) })
      .from(deliveryProofs)
      .where(like(deliveryProofs.mediaRef, "data:%"))
      .limit(Math.min(options.batchSize, options.limit - processed));

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      processed += 1;
      const parsed = parseDataUrl(row.mediaRef);

      if (!parsed) {
        skipped += 1;
        continue;
      }

      const objectKey = buildTenantObjectKey({
        tenantId: row.tenantId,
        purpose:
          row.type === "signature" ? "delivery_signature" : "delivery_proof",
        segments: [row.taskId],
        fileName: `${createId()}.${getExtensionForContentType(parsed.contentType)}`,
      });

      if (!options.dryRun) {
        await storage.putObject({
          objectKey,
          body: parsed.bytes,
          contentType: parsed.contentType,
          contentLength: parsed.bytes.length,
        });

        await db.insert(mediaObjects).values({
          id: createId(),
          tenantId: row.tenantId,
          objectKey,
          contentType: parsed.contentType,
          sizeBytes: parsed.bytes.length,
          status: "committed",
          purpose:
            row.type === "signature" ? "delivery_signature" : "delivery_proof",
          createdBy: row.createdBy,
          committedAt: new Date(),
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });

        await db
          .update(deliveryProofs)
          .set({ mediaRef: objectKey })
          .where(eq(deliveryProofs.id, row.id));
      }

      migrated += 1;
    }

    if (options.dryRun) {
      break;
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun: options.dryRun,
        processed,
        migrated,
        skipped,
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  await runWithSystemDatabaseContext(runBackfill);
}

if (process.argv[1]?.endsWith("backfill-delivery-proof-media.ts")) {
  main()
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await closeDbConnection();
    });
}
