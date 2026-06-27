import assert from "node:assert/strict";

import { MediaService } from "./media.service.js";
import type { MediaObjectRecord } from "./media.types.js";

function record(input: Partial<MediaObjectRecord>): MediaObjectRecord {
  return {
    id: input.id ?? "media_1",
    tenantId: input.tenantId ?? "tenant_1",
    objectKey: input.objectKey ?? "tenant/tenant_1/delivery_proof/task/file.jpg",
    contentType: input.contentType ?? "image/jpeg",
    sizeBytes: input.sizeBytes ?? 128,
    status: input.status ?? "pending",
    purpose: input.purpose ?? "delivery_proof",
    createdBy: input.createdBy ?? "driver_1",
    createdAt: input.createdAt ?? new Date().toISOString(),
    committedAt: input.committedAt ?? null,
    expiresAt: input.expiresAt ?? new Date(Date.now() - 60_000).toISOString(),
  };
}

export async function runMediaSmokeChecks(): Promise<void> {
  const expired = record({});
  const deletedKeys: string[] = [];
  const softDeletedKeys: string[] = [];
  const service = new MediaService({
    storageConfig: {
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      bucket: "cleanhub-media",
      accessKeyId: "cleanhub",
      secretAccessKey: "cleanhub-minio-password",
      forcePathStyle: true,
      uploadUrlTtlSeconds: 900,
      downloadUrlTtlSeconds: 300,
      pendingTtlSeconds: 3600,
      maxFileSizeBytes: 1024,
      allowedContentTypes: ["image/jpeg"],
    },
    repository: {
      async createPending() {
        return expired;
      },
      async findByObjectKey() {
        return expired;
      },
      async markCommitted() {
        return { ...expired, status: "committed" };
      },
      async listExpiredPending() {
        return [expired];
      },
      async softDelete({ objectKey }) {
        softDeletedKeys.push(objectKey);
        return true;
      },
    },
    objectStorage: {
      async presignUpload() {
        return {
          objectKey: expired.objectKey,
          uploadUrl: "https://upload.local",
          headers: {},
          expiresAt: new Date(),
        };
      },
      async presignDownload() {
        return {
          objectKey: expired.objectKey,
          downloadUrl: "https://download.local",
          expiresAt: new Date(),
        };
      },
      async headObject() {
        return {
          objectKey: expired.objectKey,
          contentType: expired.contentType,
          contentLength: expired.sizeBytes,
        };
      },
      async deleteObject(objectKey: string) {
        deletedKeys.push(objectKey);
      },
    },
  });

  const result = await service.cleanupExpiredPending({ limit: 10 });

  assert.equal(result.scanned, 1);
  assert.equal(result.deleted, 1);
  assert.equal(result.failed, 0);
  assert.deepEqual(deletedKeys, [expired.objectKey]);
  assert.deepEqual(softDeletedKeys, [expired.objectKey]);

  const missingObjectService = new MediaService({
    storageConfig: {
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      bucket: "cleanhub-media",
      accessKeyId: "cleanhub",
      secretAccessKey: "cleanhub-minio-password",
      forcePathStyle: true,
      uploadUrlTtlSeconds: 900,
      downloadUrlTtlSeconds: 300,
      pendingTtlSeconds: 3600,
      maxFileSizeBytes: 1024,
      allowedContentTypes: ["image/jpeg"],
    },
    repository: {
      async createPending() {
        return expired;
      },
      async findByObjectKey() {
        return expired;
      },
      async markCommitted() {
        throw new Error("missing object should not be committed");
      },
      async listExpiredPending() {
        return [];
      },
      async softDelete() {
        return true;
      },
    },
    objectStorage: {
      async presignUpload() {
        return {
          objectKey: expired.objectKey,
          uploadUrl: "https://upload.local",
          headers: {},
          expiresAt: new Date(),
        };
      },
      async presignDownload() {
        return {
          objectKey: expired.objectKey,
          downloadUrl: "https://download.local",
          expiresAt: new Date(),
        };
      },
      async headObject() {
        const error = new Error("not found") as Error & {
          $metadata: { httpStatusCode: number };
        };
        error.$metadata = { httpStatusCode: 404 };
        throw error;
      },
      async deleteObject() {},
    },
  });

  await assert.rejects(
    () =>
      missingObjectService.assertOwnedAndCommit({
        tenantId: expired.tenantId,
        objectKey: expired.objectKey,
        expectedPurpose: expired.purpose,
      }),
    { name: "MediaError", code: "MEDIA_NOT_FOUND" },
  );
}

if (process.argv[1]?.endsWith("media.smoke.ts")) {
  await runMediaSmokeChecks();
}
