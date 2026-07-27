"use server";

import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type {
  DiscountFormErrors,
  DiscountFormValues,
  TenantDiscountDetail,
} from "../types";
import { validateDiscountForm } from "../validators";
import {
  getDiscountActionError,
  type DiscountActionError,
} from "./discount-action-errors";

export type UpdateDiscountActionResult =
  | { ok: true; data: TenantDiscountDetail }
  | ({ ok: false; errors: DiscountFormErrors } & DiscountActionError);

export async function updateDiscountAction(
  discountId: string,
  version: number,
  input: DiscountFormValues,
  timeZone: string,
): Promise<UpdateDiscountActionResult> {
  const validation = validateDiscountForm(input, timeZone);

  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      message: "Check the discount form.",
    };
  }

  try {
    const updateData = { ...validation.data };
    Reflect.deleteProperty(updateData, "type");
    const discount = await webAdminApi.tenant.discounts.update(
      discountId,
      {
        ...(updateData as Omit<typeof validation.data, "type">),
        version,
      },
      await getTenantServerApiRequestOptions(),
    );

    revalidatePath(webAdminRoutes.tenant.discounts);
    revalidatePath(webAdminRoutes.tenant.discount(discountId));

    return { ok: true, data: discount };
  } catch (error) {
    return {
      ok: false,
      ...getDiscountActionError(error, "Discount could not be updated."),
    };
  }
}
