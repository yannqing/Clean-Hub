"use server";

import type { TenantProductMediaUploadTicket } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import { isProductsFeatureDisabled } from "../product-access";

const MAX_PRODUCT_MEDIA_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PRODUCT_MEDIA_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export type UploadProductMediaActionResult =
  | {
      ok: true;
      ticket: TenantProductMediaUploadTicket;
    }
  | {
      ok: false;
      reason: "missing" | "type" | "size" | "upload" | "feature_disabled";
    };

export async function uploadProductMediaAction(input: {
  contentType: string;
  sizeBytes: number;
}): Promise<UploadProductMediaActionResult> {
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { ok: false, reason: "missing" };
  }

  if (!ALLOWED_PRODUCT_MEDIA_TYPES.has(input.contentType)) {
    return { ok: false, reason: "type" };
  }

  if (input.sizeBytes > MAX_PRODUCT_MEDIA_SIZE_BYTES) {
    return { ok: false, reason: "size" };
  }

  try {
    const requestOptions = await getTenantServerApiRequestOptions();
    const ticket = await webAdminApi.tenant.products.requestMediaUpload(
      {
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      },
      requestOptions,
    );

    return {
      ok: true,
      ticket,
    };
  } catch (error) {
    if (isProductsFeatureDisabled(error)) {
      return { ok: false, reason: "feature_disabled" };
    }
    return { ok: false, reason: "upload" };
  }
}
