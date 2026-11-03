"use server";

import type { TenantDiscountListQuery, TenantDiscountSummary } from "../types";
import { getDiscountExportDatasetQuery } from "../queries";
import {
  getDiscountActionError,
  type DiscountActionError,
} from "./discount-action-errors";

export type ExportDiscountsActionResult =
  | { ok: true; data: TenantDiscountSummary[] }
  | ({ ok: false } & DiscountActionError);

export async function exportDiscountsAction(
  query: Omit<TenantDiscountListQuery, "limit" | "offset">,
): Promise<ExportDiscountsActionResult> {
  try {
    return {
      ok: true,
      data: await getDiscountExportDatasetQuery(query),
    };
  } catch (error) {
    return {
      ok: false,
      ...getDiscountActionError(error, "Discounts could not be exported."),
    };
  }
}
