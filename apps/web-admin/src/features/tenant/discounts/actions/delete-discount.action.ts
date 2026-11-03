"use server";

import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import {
  getDiscountActionError,
  type DiscountActionError,
} from "./discount-action-errors";

export type DeleteDiscountActionResult =
  | { ok: true }
  | ({ ok: false } & DiscountActionError);

export async function deleteDiscountAction(
  discountId: string,
  version: number,
): Promise<DeleteDiscountActionResult> {
  try {
    await webAdminApi.tenant.discounts.delete(
      discountId,
      { version },
      await getTenantServerApiRequestOptions(),
    );

    revalidatePath(webAdminRoutes.tenant.discounts);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      ...getDiscountActionError(error, "Discount could not be deleted."),
    };
  }
}
