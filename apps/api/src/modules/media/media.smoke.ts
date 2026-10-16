import assert from "node:assert/strict";

import { MediaService } from "./media.service.js";
import { MediaError, type MediaObjectRecord } from "./media.types.js";

function record(input: Partial<MediaObjectRecord>): MediaObjectRecord {
  return {
    id: input.id ?? "media_1",
    tenantId: input.tenantId ?? "tenant_1",
    objectKey:
      input.objectKey ?? "tenant/tenant_1/delivery_proof/task/file.jpg",
    contentType: input.contentType ?? "image/jpeg",
    sizeBytes: input.sizeBytes ?? 128,
    status: input.status ?? "pending",
    purpose: input.purpose ?? "delivery_proof",
    createdBy: input.createdBy ?? "driver_1",
    createdAt: input.createdAt ?? new Date().toISOString(),
    committedAt: input.committedAt ?? null,
    expiresAt: input.expiresAt ?? new Date(Date.now() - 60_000).toISOString(),
    cleanupClaimToken: input.cleanupClaimToken ?? null,
    cleanupClaimedAt: input.cleanupClaimedAt ?? null,
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
      async claimExpiredPending({ claimToken, now }) {
        return [
          {
            ...expired,
            status: "deleting",
            cleanupClaimToken: claimToken,
            cleanupClaimedAt: now.toISOString(),
          },
        ];
      },
      async completeCleanup({ objectKey }) {
        softDeletedKeys.push(objectKey);
        return true;
      },
      async releaseCleanup() {
        return false;
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

  const knownCommittedDownload =
    await service.createDownloadLinkForKnownCommittedObject({
      tenantId: expired.tenantId,
      objectKey: expired.objectKey,
    });
  assert.equal(knownCommittedDownload.downloadUrl, "https://download.local");
  await assert.rejects(
    service.createDownloadLinkForKnownCommittedObject({
      tenantId: "tenant_2",
      objectKey: expired.objectKey,
    }),
    (error: unknown) =>
      error instanceof MediaError && error.code === "MEDIA_FORBIDDEN",
  );

  const failedDeleteClaimedAt = new Date().toISOString();
  const failedDeleteRecord = record({
    status: "deleting",
    cleanupClaimToken: "01KRERJN800000000000000099",
    cleanupClaimedAt: failedDeleteClaimedAt,
  });
  const releasedClaims: Array<{
    claimToken: string;
    claimedAt: Date;
  }> = [];
  const failedDeleteService = new MediaService({
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
        return failedDeleteRecord;
      },
      async findByObjectKey() {
        return failedDeleteRecord;
      },
      async markCommitted() {
        return null;
      },
      async claimExpiredPending() {
        return [
          {
            ...failedDeleteRecord,
            status: "deleting",
            cleanupClaimToken: failedDeleteRecord.cleanupClaimToken!,
            cleanupClaimedAt: failedDeleteRecord.cleanupClaimedAt!,
          },
        ];
      },
      async completeCleanup() {
        throw new Error("failed deletion must never be finalized");
      },
      async releaseCleanup({ claimToken, claimedAt }) {
        releasedClaims.push({ claimToken, claimedAt });
        return true;
      },
    },
    objectStorage: {
      async presignUpload() {
        throw new Error("not used");
      },
      async presignDownload() {
        throw new Error("not used");
      },
      async headObject() {
        throw new Error("not used");
      },
      async deleteObject() {
        throw new Error("temporary storage failure");
      },
    },
  });

  const failedDeleteResult = await failedDeleteService.cleanupExpiredPending({
    limit: 10,
  });

  assert.deepEqual(failedDeleteResult, {
    scanned: 1,
    deleted: 0,
    failed: 1,
  });
  assert.deepEqual(releasedClaims, [
    {
      claimToken: failedDeleteRecord.cleanupClaimToken,
      claimedAt: new Date(failedDeleteClaimedAt),
    },
  ]);

  const uploadedPending = record({
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  let committedCount = 0;
  let headCount = 0;
  const uploadedPendingService = new MediaService({
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
        return uploadedPending;
      },
      async findByObjectKey() {
        return uploadedPending;
      },
      async markCommitted() {
        committedCount += 1;
        return { ...uploadedPending, status: "committed" };
      },
      async claimExpiredPending() {
        return [];
      },
      async completeCleanup() {
        return true;
      },
      async releaseCleanup() {
        return true;
      },
    },
    objectStorage: {
      async presignUpload() {
        return {
          objectKey: uploadedPending.objectKey,
          uploadUrl: "https://upload.local",
          headers: {},
          expiresAt: new Date(),
        };
      },
      async presignDownload() {
        return {
          objectKey: uploadedPending.objectKey,
          downloadUrl: "https://download.local",
          expiresAt: new Date(),
        };
      },
      async headObject() {
        headCount += 1;
        return {
          objectKey: uploadedPending.objectKey,
          contentType: uploadedPending.contentType,
          contentLength: uploadedPending.sizeBytes,
        };
      },
      async deleteObject() {},
    },
  });

  const verifiedPending =
    await uploadedPendingService.assertOwnedPendingAndUploaded({
      tenantId: uploadedPending.tenantId,
      objectKey: uploadedPending.objectKey,
      expectedPurpose: uploadedPending.purpose,
      expectedCreatedBy: uploadedPending.createdBy!,
    });

  assert.equal(verifiedPending.status, "pending");
  assert.equal(headCount, 1);
  assert.equal(
    committedCount,
    0,
    "verification must not commit outside the owning domain transaction",
  );

  await assert.rejects(
    () =>
      uploadedPendingService.assertOwnedPendingAndUploaded({
        tenantId: uploadedPending.tenantId,
        objectKey: uploadedPending.objectKey,
        expectedPurpose: uploadedPending.purpose,
        expectedCreatedBy: "another-user",
      }),
    { name: "MediaError", code: "MEDIA_FORBIDDEN" },
  );

  let unavailableStatus: "committed" | "deleting" = "committed";
  const committedService = new MediaService({
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
        return { ...uploadedPending, status: unavailableStatus };
      },
      async findByObjectKey() {
        return {
          ...uploadedPending,
          status: unavailableStatus,
          cleanupClaimToken:
            unavailableStatus === "deleting"
              ? "01KRERJN800000000000000098"
              : null,
          cleanupClaimedAt:
            unavailableStatus === "deleting" ? new Date().toISOString() : null,
        };
      },
      async markCommitted() {
        throw new Error("already committed media must not be committed again");
      },
      async claimExpiredPending() {
        return [];
      },
      async completeCleanup() {
        return true;
      },
      async releaseCleanup() {
        return true;
      },
    },
    objectStorage: {
      async presignUpload() {
        throw new Error("not used");
      },
      async presignDownload() {
        throw new Error("not used");
      },
      async headObject() {
        throw new Error("already committed media must be rejected before HEAD");
      },
      async deleteObject() {},
    },
  });

  await assert.rejects(
    () =>
      committedService.assertOwnedPendingAndUploaded({
        tenantId: uploadedPending.tenantId,
        objectKey: uploadedPending.objectKey,
        expectedPurpose: uploadedPending.purpose,
        expectedCreatedBy: uploadedPending.createdBy!,
      }),
    { name: "MediaError", code: "MEDIA_CONFLICT" },
  );

  unavailableStatus = "deleting";
  await assert.rejects(
    () =>
      committedService.assertOwnedPendingAndUploaded({
        tenantId: uploadedPending.tenantId,
        objectKey: uploadedPending.objectKey,
        expectedPurpose: uploadedPending.purpose,
        expectedCreatedBy: uploadedPending.createdBy!,
      }),
    { name: "MediaError", code: "MEDIA_CONFLICT" },
  );

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
      async claimExpiredPending() {
        return [];
      },
      async completeCleanup() {
        return true;
      },
      async releaseCleanup() {
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
