import {
  ObjectStorage,
  StorageValidationError,
  assertTenantObjectKey,
  buildTenantObjectPrefix,
  buildTenantObjectKey,
  getExtensionForContentType,
  loadStorageConfig,
  validateMediaContentType,
  validateMediaFileSize,
  type StorageConfig,
} from "@cleanhub/storage";
import { createId } from "@cleanhub/id";

import { MediaRepository } from "./media.repository.js";
import { MediaError } from "./media.types.js";
import type {
  CleanupExpiredMediaResult,
  MediaDownloadTicket,
  MediaObjectRecord,
  MediaUploadTicket,
  RequestMediaUploadInput,
} from "./media.types.js";

export type MediaServiceOptions = {
  repository?: MediaRepositoryLike;
  objectStorage?: ObjectStorageLike;
  storageConfig?: StorageConfig;
};

export type MediaRepositoryLike = Pick<
  MediaRepository,
  | "createPending"
  | "findByObjectKey"
  | "markCommitted"
  | "claimExpiredPending"
  | "completeCleanup"
  | "releaseCleanup"
>;

export type ObjectStorageLike = Pick<
  ObjectStorage,
  "presignUpload" | "presignDownload" | "deleteObject" | "headObject"
>;

export class MediaService {
  private static readonly CLEANUP_CLAIM_TIMEOUT_MS = 5 * 60 * 1000;

  private readonly repository: MediaRepositoryLike;
  private readonly objectStorage: ObjectStorageLike;
  private readonly storageConfig: StorageConfig;

  constructor(options: MediaServiceOptions = {}) {
    this.storageConfig = options.storageConfig ?? loadStorageConfig();
    this.repository = options.repository ?? new MediaRepository();
    this.objectStorage =
      options.objectStorage ?? new ObjectStorage(this.storageConfig);
  }

  async requestUpload(
    input: RequestMediaUploadInput,
  ): Promise<MediaUploadTicket> {
    this.validateContent(input.contentType, input.sizeBytes);

    const objectId = createId();
    const objectKey = this.buildObjectKey({
      tenantId: input.tenantId,
      purpose: input.purpose,
      entityId: input.entityId,
      fileName: `${objectId}.${getExtensionForContentType(input.contentType)}`,
    });
    const expiresAt = new Date(
      Date.now() + this.storageConfig.pendingTtlSeconds * 1000,
    );

    await this.repository.createPending({
      tenantId: input.tenantId,
      objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      purpose: input.purpose,
      createdBy: input.actorUserId,
      expiresAt,
    });

    const upload = await this.objectStorage.presignUpload({
      objectKey,
      contentType: input.contentType,
      contentLength: input.sizeBytes,
    });

    return {
      objectKey: upload.objectKey,
      uploadUrl: upload.uploadUrl,
      headers: upload.headers,
      expiresAt: upload.expiresAt.toISOString(),
    };
  }

  /**
   * Verifies that an upload belongs to the expected actor and tenant and that
   * its bytes are present in object storage. This deliberately leaves the
   * media object pending so the owning domain can commit it atomically with
   * the record that references it.
   */
  async assertOwnedPendingAndUploaded(input: {
    tenantId: string;
    objectKey: string;
    expectedPurpose: string;
    expectedCreatedBy: string;
  }): Promise<MediaObjectRecord> {
    this.assertTenantKey(input.tenantId, input.objectKey);

    const record = await this.repository.findByObjectKey({
      tenantId: input.tenantId,
      objectKey: input.objectKey,
    });

    if (!record) {
      throw new MediaError(
        "MEDIA_NOT_FOUND",
        "Media object was not found.",
        404,
      );
    }

    if (record.purpose !== input.expectedPurpose) {
      throw new MediaError(
        "MEDIA_VALIDATION_ERROR",
        "Media object purpose does not match this operation.",
        422,
      );
    }

    if (record.createdBy !== input.expectedCreatedBy) {
      throw new MediaError(
        "MEDIA_FORBIDDEN",
        "Media object is not accessible.",
        403,
      );
    }

    if (record.status !== "pending") {
      throw new MediaError(
        "MEDIA_CONFLICT",
        record.status === "deleting"
          ? "Media object is being deleted."
          : "Media object has already been committed.",
        409,
      );
    }

    await this.assertUploadedObject(record);

    return record;
  }

  async assertOwnedAndCommit(input: {
    tenantId: string;
    objectKey: string;
    expectedPurpose?: string;
    expectedEntityId?: string;
    expectedCreatedBy?: string;
  }): Promise<MediaObjectRecord> {
    this.assertTenantKey(input.tenantId, input.objectKey);

    const record = await this.repository.findByObjectKey({
      tenantId: input.tenantId,
      objectKey: input.objectKey,
    });

    if (!record) {
      throw new MediaError(
        "MEDIA_NOT_FOUND",
        "Media object was not found.",
        404,
      );
    }

    if (input.expectedPurpose && record.purpose !== input.expectedPurpose) {
      throw new MediaError(
        "MEDIA_VALIDATION_ERROR",
        "Media object purpose does not match this operation.",
        422,
      );
    }

    if (
      input.expectedCreatedBy &&
      record.createdBy !== input.expectedCreatedBy
    ) {
      throw new MediaError(
        "MEDIA_FORBIDDEN",
        "Media object is not accessible.",
        403,
      );
    }

    if (input.expectedPurpose && input.expectedEntityId) {
      this.assertEntityKey({
        tenantId: input.tenantId,
        purpose: input.expectedPurpose,
        entityId: input.expectedEntityId,
        objectKey: input.objectKey,
      });
    }

    if (record.status === "committed") {
      return record;
    }

    if (record.status !== "pending") {
      throw new MediaError(
        "MEDIA_CONFLICT",
        "Media object is being deleted.",
        409,
      );
    }

    await this.assertUploadedObject(record);

    const committed = await this.repository.markCommitted({
      tenantId: input.tenantId,
      objectKey: input.objectKey,
    });

    if (!committed) {
      throw new MediaError(
        "MEDIA_NOT_FOUND",
        "Media object was not found.",
        404,
      );
    }

    return committed;
  }

  async createDownloadLink(input: {
    tenantId: string;
    objectKey: string;
  }): Promise<MediaDownloadTicket> {
    this.assertTenantKey(input.tenantId, input.objectKey);

    const record = await this.repository.findByObjectKey(input);

    if (!record) {
      throw new MediaError(
        "MEDIA_NOT_FOUND",
        "Media object was not found.",
        404,
      );
    }

    const download = await this.objectStorage.presignDownload({
      objectKey: input.objectKey,
    });

    return {
      objectKey: download.objectKey,
      downloadUrl: download.downloadUrl,
      expiresAt: download.expiresAt.toISOString(),
    };
  }

  /**
   * Creates a link for an object that an owning domain has already selected
   * from a tenant-scoped, committed-media query.
   */
  async createDownloadLinkForKnownCommittedObject(input: {
    tenantId: string;
    objectKey: string;
  }): Promise<MediaDownloadTicket> {
    this.assertTenantKey(input.tenantId, input.objectKey);

    const download = await this.objectStorage.presignDownload({
      objectKey: input.objectKey,
    });

    return {
      objectKey: download.objectKey,
      downloadUrl: download.downloadUrl,
      expiresAt: download.expiresAt.toISOString(),
    };
  }

  async cleanupExpiredPending(
    input: {
      now?: Date;
      limit?: number;
      claimTimeoutMs?: number;
    } = {},
  ): Promise<CleanupExpiredMediaResult> {
    const now = input.now ?? new Date();
    const claimTimeoutMs =
      input.claimTimeoutMs ?? MediaService.CLEANUP_CLAIM_TIMEOUT_MS;
    const records = await this.repository.claimExpiredPending({
      now,
      staleClaimedBefore: new Date(now.getTime() - claimTimeoutMs),
      limit: input.limit ?? 100,
      claimToken: createId(),
    });
    let deleted = 0;
    let failed = 0;

    for (const record of records) {
      const claim = {
        id: record.id,
        tenantId: record.tenantId,
        objectKey: record.objectKey,
        claimToken: record.cleanupClaimToken,
        claimedAt: new Date(record.cleanupClaimedAt),
      };

      try {
        await this.objectStorage.deleteObject(record.objectKey);
      } catch {
        await this.repository.releaseCleanup(claim).catch(() => false);
        failed += 1;
        continue;
      }

      try {
        const completed = await this.repository.completeCleanup(claim);

        if (completed) {
          deleted += 1;
        } else {
          failed += 1;
        }
      } catch {
        // Leave the record in `deleting`. A later cleanup run may reclaim the
        // stale claim and safely retry the idempotent object deletion.
        failed += 1;
      }
    }

    return {
      scanned: records.length,
      deleted,
      failed,
    };
  }

  private validateContent(contentType: string, sizeBytes: number): void {
    try {
      validateMediaContentType(
        contentType,
        this.storageConfig.allowedContentTypes,
      );
      validateMediaFileSize(sizeBytes, this.storageConfig.maxFileSizeBytes);
    } catch (error) {
      if (error instanceof StorageValidationError) {
        throw new MediaError("MEDIA_VALIDATION_ERROR", error.message, 422);
      }

      throw error;
    }
  }

  private assertTenantKey(tenantId: string, objectKey: string): void {
    try {
      assertTenantObjectKey(objectKey, tenantId);
    } catch (error) {
      if (error instanceof StorageValidationError) {
        throw new MediaError(
          "MEDIA_FORBIDDEN",
          "Media object is not accessible.",
          403,
        );
      }

      throw error;
    }
  }

  private assertEntityKey(input: {
    tenantId: string;
    purpose: string;
    entityId: string;
    objectKey: string;
  }): void {
    try {
      const prefix = `${buildTenantObjectPrefix(
        input.tenantId,
        input.purpose,
      )}/${input.entityId}/`;

      if (!input.objectKey.startsWith(prefix)) {
        throw new StorageValidationError(
          "Object key does not belong to this entity.",
        );
      }
    } catch (error) {
      if (error instanceof StorageValidationError) {
        throw new MediaError(
          "MEDIA_FORBIDDEN",
          "Media object is not accessible.",
          403,
        );
      }

      throw error;
    }
  }

  private buildObjectKey(input: {
    tenantId: string;
    purpose: string;
    entityId?: string;
    fileName: string;
  }): string {
    try {
      return buildTenantObjectKey({
        tenantId: input.tenantId,
        purpose: input.purpose,
        segments: [input.entityId ?? "unassigned"],
        fileName: input.fileName,
      });
    } catch (error) {
      if (error instanceof StorageValidationError) {
        throw new MediaError("MEDIA_VALIDATION_ERROR", error.message, 422);
      }

      throw error;
    }
  }

  private async assertUploadedObject(record: MediaObjectRecord): Promise<void> {
    let objectMetadata: Awaited<ReturnType<ObjectStorageLike["headObject"]>>;

    try {
      objectMetadata = await this.objectStorage.headObject(record.objectKey);
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } })
        .$metadata?.httpStatusCode;

      if (status === 404 || (error as { name?: string }).name === "NotFound") {
        throw new MediaError(
          "MEDIA_NOT_FOUND",
          "Media object was not uploaded.",
          404,
        );
      }

      throw new MediaError(
        "MEDIA_STORAGE_ERROR",
        "Media object storage is unavailable.",
        500,
      );
    }

    if (
      objectMetadata.contentLength !== null &&
      objectMetadata.contentLength !== record.sizeBytes
    ) {
      throw new MediaError(
        "MEDIA_VALIDATION_ERROR",
        "Media object size does not match the upload ticket.",
        422,
      );
    }

    if (
      objectMetadata.contentType &&
      objectMetadata.contentType.toLowerCase() !==
        record.contentType.toLowerCase()
    ) {
      throw new MediaError(
        "MEDIA_VALIDATION_ERROR",
        "Media object content type does not match the upload ticket.",
        422,
      );
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      throw new MediaError(
        "MEDIA_VALIDATION_ERROR",
        "Media upload ticket has expired.",
        422,
      );
    }
  }
}

export function createMediaServiceFromEnv(): MediaService {
  return new MediaService();
}
