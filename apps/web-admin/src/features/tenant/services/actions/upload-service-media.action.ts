"use server";

import type { TenantServiceMediaUploadTicket } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";

const MAX_SERVICE_MEDIA_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_SERVICE_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type UploadServiceMediaActionResult =
  | { ok: true; ticket: TenantServiceMediaUploadTicket }
  | { ok: false; reason: "missing" | "type" | "size" | "upload" };

export async function uploadServiceMediaAction(input: {
  contentType: string;
  sizeBytes: number;
}): Promise<UploadServiceMediaActionResult> {
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, reason: "missing" };
  }

  if (!ALLOWED_SERVICE_MEDIA_TYPES.has(input.contentType)) {
    return { ok: false, reason: "type" };
  }

  if (input.sizeBytes > MAX_SERVICE_MEDIA_SIZE_BYTES) {
    return { ok: false, reason: "size" };
  }

  try {
    const requestOptions = await getTenantServerApiRequestOptions();
    const ticket = await webAdminApi.tenant.services.requestMediaUpload(
      input,
      requestOptions,
    );

    return { ok: true, ticket };
  } catch {
    return { ok: false, reason: "upload" };
  }
}
