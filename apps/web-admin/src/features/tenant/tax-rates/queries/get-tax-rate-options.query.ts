import "server-only";

import type { ApiRequestOptions } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import type { TaxRateOptions } from "../types";

/**
 * Rates for the service and product forms. Archived rates are included so an
 * item that still carries one shows it; the select only offers active ones
 * for a new choice.
 *
 * Never throws: a form must still open when tax rates cannot be read, and
 * then it leaves the item's rate untouched.
 */
export async function getTaxRateOptionsQuery(
  requestOptions: Omit<ApiRequestOptions, "method" | "body">,
): Promise<TaxRateOptions> {
  const [rates, settings] = await Promise.allSettled([
    webAdminApi.tenant.taxRates.list({ includeArchived: true }, requestOptions),
    webAdminApi.tenant.posChannel.getSettings(requestOptions),
  ]);

  return {
    rates: rates.status === "fulfilled" ? rates.value : [],
    defaultRate:
      settings.status === "fulfilled" ? settings.value.defaultTaxRate : null,
    taxEnabled:
      settings.status === "fulfilled" ? settings.value.taxEnabled : true,
    loadFailed: rates.status === "rejected",
  };
}
