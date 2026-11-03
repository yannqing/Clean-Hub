"use server";

import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { TenantDiscountDetail } from "../types";
import {
  getDiscountActionError,
  type DiscountActionError,
} from "./discount-action-errors";

export type UpdateDiscountStatusActionResult =
  | { ok: true; data: TenantDiscountDetail }
  | ({ ok: false } & DiscountActionError);

export async function updateDiscountStatusAction(
  discountId: string,
  enabled: boolean,
  version: number,
): Promise<UpdateDiscountStatusActionResult> {
  try {
    const discount = await webAdminApi.tenant.discounts.updateStatus(
      discountId,
      { enabled, version },
      await getTenantServerApiRequestOptions(),
    );

    revalidatePath(webAdminRoutes.tenant.discounts);
    revalidatePath(webAdminRoutes.tenant.discount(discountId));

    return { ok: true, data: discount };
  } catch (error) {
    return {
      ok: false,
      ...getDiscountActionError(error, "Discount status could not be updated."),
    };
  }
}
