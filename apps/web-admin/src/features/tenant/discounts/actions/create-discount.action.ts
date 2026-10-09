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

export type CreateDiscountActionResult =
  | { ok: true; data: TenantDiscountDetail }
  | ({ ok: false; errors: DiscountFormErrors } & DiscountActionError);

export async function createDiscountAction(
  input: DiscountFormValues,
  timeZone: string,
): Promise<CreateDiscountActionResult> {
  const validation = validateDiscountForm(input, timeZone);

  if (!validation.ok) {
    return {
      ok: false,
      errors: validation.errors,
      message: "Check the discount form.",
    };
  }

  try {
    const discount = await webAdminApi.tenant.discounts.create(
      validation.data,
      await getTenantServerApiRequestOptions(),
    );

    revalidatePath(webAdminRoutes.tenant.discounts);

    return { ok: true, data: discount };
  } catch (error) {
    return {
      ok: false,
      ...getDiscountActionError(error, "Discount could not be created."),
    };
  }
}
