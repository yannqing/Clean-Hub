"use server";

import type { BranchLogoUploadTicket } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";

const MAX_BRANCH_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_BRANCH_LOGO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type UploadBranchLogoActionResult =
  | { ok: true; ticket: BranchLogoUploadTicket }
  | { ok: false; reason: "missing" | "type" | "size" | "upload" };

export async function uploadBranchLogoAction(input: {
  contentType: string;
  sizeBytes: number;
}): Promise<UploadBranchLogoActionResult> {
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, reason: "missing" };
  }

  if (!ALLOWED_BRANCH_LOGO_TYPES.has(input.contentType)) {
    return { ok: false, reason: "type" };
  }

  if (input.sizeBytes > MAX_BRANCH_LOGO_SIZE_BYTES) {
    return { ok: false, reason: "size" };
  }

  try {
    const ticket = await webAdminApi.tenant.branches.requestLogoUpload(
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
