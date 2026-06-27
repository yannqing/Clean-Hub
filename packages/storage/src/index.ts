import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const DEFAULT_MEDIA_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const DEFAULT_MEDIA_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const DEFAULT_UPLOAD_URL_TTL_SECONDS = 15 * 60;
export const DEFAULT_DOWNLOAD_URL_TTL_SECONDS = 5 * 60;
export const DEFAULT_PENDING_TTL_SECONDS = 60 * 60;

export type MediaPurpose = "delivery_proof" | "delivery_signature" | string;

export type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  uploadUrlTtlSeconds: number;
  downloadUrlTtlSeconds: number;
  pendingTtlSeconds: number;
  maxFileSizeBytes: number;
  allowedContentTypes: string[];
};

export type StorageEnv = Partial<
  Record<
    | "OBJECT_STORAGE_ENDPOINT"
    | "OBJECT_STORAGE_REGION"
    | "OBJECT_STORAGE_BUCKET"
    | "OBJECT_STORAGE_ACCESS_KEY"
    | "OBJECT_STORAGE_SECRET_KEY"
    | "OBJECT_STORAGE_FORCE_PATH_STYLE"
    | "OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS"
    | "OBJECT_STORAGE_DOWNLOAD_URL_TTL_SECONDS"
    | "OBJECT_STORAGE_PENDING_TTL_SECONDS"
    | "OBJECT_STORAGE_MAX_FILE_SIZE_BYTES"
    | "OBJECT_STORAGE_ALLOWED_CONTENT_TYPES",
    string
  >
>;

export type BuildObjectKeyInput = {
  tenantId: string;
  purpose: MediaPurpose;
  segments?: string[];
  fileName: string;
};

export type PresignUploadInput = {
  objectKey: string;
  contentType: string;
  contentLength?: number;
  expiresInSeconds?: number;
};

export type PresignDownloadInput = {
  objectKey: string;
  expiresInSeconds?: number;
};

export type PutObjectInput = {
  objectKey: string;
  body: Uint8Array;
  contentType: string;
  contentLength?: number;
};

export type HeadObjectResult = {
  objectKey: string;
  contentType: string | null;
  contentLength: number | null;
};

export type PresignedUpload = {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: Date;
};

export type PresignedDownload = {
  objectKey: string;
  downloadUrl: string;
  expiresAt: Date;
};

export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigError";
  }
}

export class StorageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageValidationError";
  }
}

export function loadStorageConfig(
  env: StorageEnv = process.env,
): StorageConfig {
  const endpoint = readRequired(env.OBJECT_STORAGE_ENDPOINT, "OBJECT_STORAGE_ENDPOINT");
  const bucket = readRequired(env.OBJECT_STORAGE_BUCKET, "OBJECT_STORAGE_BUCKET");
  const accessKeyId = readRequired(env.OBJECT_STORAGE_ACCESS_KEY, "OBJECT_STORAGE_ACCESS_KEY");
  const secretAccessKey = readRequired(env.OBJECT_STORAGE_SECRET_KEY, "OBJECT_STORAGE_SECRET_KEY");

  return {
    endpoint,
    bucket,
    accessKeyId,
    secretAccessKey,
    region: env.OBJECT_STORAGE_REGION?.trim() || "us-east-1",
    forcePathStyle: parseBoolean(env.OBJECT_STORAGE_FORCE_PATH_STYLE, true),
    uploadUrlTtlSeconds: parsePositiveInteger(
      env.OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS,
      DEFAULT_UPLOAD_URL_TTL_SECONDS,
      "OBJECT_STORAGE_UPLOAD_URL_TTL_SECONDS",
    ),
    downloadUrlTtlSeconds: parsePositiveInteger(
      env.OBJECT_STORAGE_DOWNLOAD_URL_TTL_SECONDS,
      DEFAULT_DOWNLOAD_URL_TTL_SECONDS,
      "OBJECT_STORAGE_DOWNLOAD_URL_TTL_SECONDS",
    ),
    pendingTtlSeconds: parsePositiveInteger(
      env.OBJECT_STORAGE_PENDING_TTL_SECONDS,
      DEFAULT_PENDING_TTL_SECONDS,
      "OBJECT_STORAGE_PENDING_TTL_SECONDS",
    ),
    maxFileSizeBytes: parsePositiveInteger(
      env.OBJECT_STORAGE_MAX_FILE_SIZE_BYTES,
      DEFAULT_MEDIA_MAX_FILE_SIZE_BYTES,
      "OBJECT_STORAGE_MAX_FILE_SIZE_BYTES",
    ),
    allowedContentTypes: parseContentTypes(env.OBJECT_STORAGE_ALLOWED_CONTENT_TYPES),
  };
}

export function createS3Client(config: StorageConfig): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function buildTenantObjectPrefix(
  tenantId: string,
  purpose: MediaPurpose,
): string {
  return `tenant/${sanitizeSegment(tenantId)}/${sanitizeSegment(purpose)}`;
}

export function buildTenantObjectKey(input: BuildObjectKeyInput): string {
  const prefix = buildTenantObjectPrefix(input.tenantId, input.purpose);
  const segments = input.segments?.map(sanitizeSegment) ?? [];
  return [prefix, ...segments, sanitizeFileName(input.fileName)].join("/");
}

export function isTenantObjectKey(
  objectKey: string,
  tenantId: string,
): boolean {
  return objectKey === `tenant/${tenantId}` || objectKey.startsWith(`tenant/${tenantId}/`);
}

export function assertTenantObjectKey(
  objectKey: string,
  tenantId: string,
): void {
  if (!isTenantObjectKey(objectKey, tenantId)) {
    throw new StorageValidationError("Object key does not belong to this tenant.");
  }
}

export function validateMediaContentType(
  contentType: string,
  allowedContentTypes: readonly string[] = DEFAULT_MEDIA_ALLOWED_CONTENT_TYPES,
): void {
  if (!allowedContentTypes.includes(contentType.toLowerCase())) {
    throw new StorageValidationError(`Unsupported media content type: ${contentType}`);
  }
}

export function validateMediaFileSize(
  sizeBytes: number,
  maxFileSizeBytes = DEFAULT_MEDIA_MAX_FILE_SIZE_BYTES,
): void {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new StorageValidationError("Media file size must be a positive integer.");
  }

  if (sizeBytes > maxFileSizeBytes) {
    throw new StorageValidationError("Media file size exceeds the configured limit.");
  }
}

export function getExtensionForContentType(contentType: string): string {
  switch (contentType.toLowerCase()) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

export class ObjectStorage {
  private readonly client: S3Client;
  private readonly config: StorageConfig;

  constructor(config: StorageConfig, client = createS3Client(config)) {
    this.config = config;
    this.client = client;
  }

  async presignUpload(input: PresignUploadInput): Promise<PresignedUpload> {
    validateMediaContentType(input.contentType, this.config.allowedContentTypes);

    if (input.contentLength !== undefined) {
      validateMediaFileSize(input.contentLength, this.config.maxFileSizeBytes);
    }

    const expiresIn = input.expiresInSeconds ?? this.config.uploadUrlTtlSeconds;
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
      ...(input.contentLength !== undefined ? { ContentLength: input.contentLength } : {}),
    });

    return {
      objectKey: input.objectKey,
      uploadUrl: await getSignedUrl(this.client, command, { expiresIn }),
      headers: {
        "content-type": input.contentType,
        ...(input.contentLength !== undefined
          ? { "content-length": String(input.contentLength) }
          : {}),
      },
      expiresAt: addSeconds(new Date(), expiresIn),
    };
  }

  async presignDownload(input: PresignDownloadInput): Promise<PresignedDownload> {
    const expiresIn = input.expiresInSeconds ?? this.config.downloadUrlTtlSeconds;
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: input.objectKey,
    });

    return {
      objectKey: input.objectKey,
      downloadUrl: await getSignedUrl(this.client, command, { expiresIn }),
      expiresAt: addSeconds(new Date(), expiresIn),
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
      }),
    );
  }

  async headObject(objectKey: string): Promise<HeadObjectResult> {
    const result = await this.client.send(
      new HeadObjectCommand({
        Bucket: this.config.bucket,
        Key: objectKey,
      }),
    );

    return {
      objectKey,
      contentType: result.ContentType ?? null,
      contentLength: result.ContentLength ?? null,
    };
  }

  async putObject(input: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: input.objectKey,
        Body: input.body,
        ContentType: input.contentType,
        ContentLength: input.contentLength ?? input.body.byteLength,
      }),
    );
  }
}

export function createObjectStorageFromEnv(
  env: StorageEnv = process.env,
): ObjectStorage {
  return new ObjectStorage(loadStorageConfig(env));
}

function readRequired(value: string | undefined, name: string): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    throw new StorageConfigError(`${name} is required.`);
  }

  return trimmed;
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function parsePositiveInteger(
  value: string | undefined,
  defaultValue: number,
  name: string,
): number {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new StorageConfigError(`${name} must be a positive integer.`);
  }

  return parsed;
}

function parseContentTypes(value: string | undefined): string[] {
  if (!value?.trim()) {
    return [...DEFAULT_MEDIA_ALLOWED_CONTENT_TYPES];
  }

  const contentTypes = value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (contentTypes.length === 0) {
    throw new StorageConfigError("OBJECT_STORAGE_ALLOWED_CONTENT_TYPES cannot be empty.");
  }

  return contentTypes;
}

function sanitizeSegment(segment: string): string {
  const normalized = segment.trim();

  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(normalized)) {
    throw new StorageValidationError(`Invalid object key segment: ${segment}`);
  }

  return normalized;
}

function sanitizeFileName(fileName: string): string {
  const normalized = fileName.trim();

  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(normalized)) {
    throw new StorageValidationError(`Invalid object file name: ${fileName}`);
  }

  return normalized;
}

function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}
