export type MediaObjectPurpose =
  | "delivery_proof"
  | "delivery_signature"
  | "product_image";

export type MediaObjectStatus = "pending" | "committed" | "deleting";

export type RequestMediaUploadInput = {
  tenantId: string;
  actorUserId: string;
  purpose: MediaObjectPurpose;
  contentType: string;
  sizeBytes: number;
  entityId?: string;
};

export type MediaUploadTicket = {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
};

export type MediaObjectRecord = {
  id: string;
  tenantId: string;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  status: MediaObjectStatus;
  purpose: string;
  createdBy: string | null;
  createdAt: string;
  committedAt: string | null;
  expiresAt: string;
  cleanupClaimToken: string | null;
  cleanupClaimedAt: string | null;
};

export type ClaimedMediaObjectRecord = MediaObjectRecord & {
  status: "deleting";
  cleanupClaimToken: string;
  cleanupClaimedAt: string;
};

export type MediaDownloadTicket = {
  objectKey: string;
  downloadUrl: string;
  expiresAt: string;
};

export type CleanupExpiredMediaResult = {
  scanned: number;
  deleted: number;
  failed: number;
};

export type MediaErrorCode =
  | "MEDIA_FORBIDDEN"
  | "MEDIA_NOT_FOUND"
  | "MEDIA_CONFLICT"
  | "MEDIA_VALIDATION_ERROR"
  | "MEDIA_STORAGE_ERROR";

export class MediaError extends Error {
  constructor(
    readonly code: MediaErrorCode,
    message: string,
    readonly status: 403 | 404 | 409 | 422 | 500,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "MediaError";
  }
}
