export type MobileMediaPurpose = "delivery_proof" | "delivery_signature";

export type MobileRequestMediaUploadRequest = {
  purpose: MobileMediaPurpose;
  contentType: string;
  sizeBytes: number;
  entityId?: string;
};

export type MobileMediaUploadTicket = {
  objectKey: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
};
