"use server";

import type { TenantCustomerAttachmentUploadTicket } from "@cleanhub/api-client";

import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function uploadTenantCustomerAttachmentAction(
  customerId: string,
  input: { contentType: string; sizeBytes: number },
): Promise<
  | { ok: true; ticket: TenantCustomerAttachmentUploadTicket }
  | { ok: false; reason: "missing" | "type" | "size" | "upload" }
> {
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, reason: "missing" };
  }
  if (!ALLOWED_ATTACHMENT_TYPES.has(input.contentType)) {
    return { ok: false, reason: "type" };
  }
  if (input.sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
    return { ok: false, reason: "size" };
  }
  try {
    const ticket = await webAdminApi.tenant.customers.requestAttachmentUpload(
      customerId,
      {
        contentType: input.contentType as
          | "image/jpeg"
          | "image/png"
          | "image/webp",
        sizeBytes: input.sizeBytes,
      },
      await getTenantServerApiRequestOptions(),
    );
    return { ok: true, ticket };
  } catch {
    return { ok: false, reason: "upload" };
  }
}
