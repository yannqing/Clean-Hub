"use server";

import type { TenantProductCategoryAttributeListResponse } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import { isProductsFeatureDisabled } from "../product-access";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export type GetProductCategoryAttributesActionResult =
  | {
      ok: true;
      data: TenantProductCategoryAttributeListResponse;
    }
  | {
      ok: false;
      reason: "invalid" | "request" | "feature_disabled";
    };

export async function getProductCategoryAttributesAction(
  categoryId: string,
): Promise<GetProductCategoryAttributesActionResult> {
  if (!ULID_PATTERN.test(categoryId)) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const data = await webAdminApi.tenant.products.categoryAttributes(
      categoryId,
      await getTenantServerApiRequestOptions(),
    );

    return { ok: true, data };
  } catch (error) {
    if (isProductsFeatureDisabled(error)) {
      return { ok: false, reason: "feature_disabled" };
    }
    return { ok: false, reason: "request" };
  }
}
