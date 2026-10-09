"use server";

import { isApiHttpError } from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import { percentToFraction } from "../percent";
import type {
  TaxRate,
  TaxRateActionErrorCode,
  TaxRateActionResult,
  UpdateTaxRateInput,
} from "../types";

function toErrorCode(error: unknown): TaxRateActionErrorCode {
  if (!isApiHttpError(error)) return "generic";
  switch (error.code) {
    case "TAX_RATE_NAME_CONFLICT":
      return "nameConflict";
    case "TAX_RATE_IN_USE":
      return "inUse";
    case "TAX_RATE_VERSION_CONFLICT":
      return "versionConflict";
    case "TAX_RATE_TEMPLATE_MANAGED":
      return "templateManaged";
    default:
      return "generic";
  }
}

function revalidateTaxRatePages() {
  revalidatePath(webAdminRoutes.tenant.system.settingsSections.pricing);
  revalidatePath(webAdminRoutes.tenant.services);
  revalidatePath(webAdminRoutes.tenant.products);
}

async function run<T>(operation: () => Promise<T>): Promise<TaxRateActionResult<T>> {
  try {
    const data = await operation();
    revalidateTaxRatePages();
    return { ok: true, data };
  } catch (error) {
    return { ok: false, code: toErrorCode(error) };
  }
}

export async function createTaxRateAction(input: {
  name: string;
  ratePercent: string;
}): Promise<TaxRateActionResult<TaxRate>> {
  const rate = percentToFraction(input.ratePercent);
  const name = input.name.trim();
  if (!rate || !name) return { ok: false, code: "generic" };
  const requestOptions = await getTenantServerApiRequestOptions();
  return run(() =>
    webAdminApi.tenant.taxRates.create({ name, rate }, requestOptions),
  );
}

export async function updateTaxRateAction(
  taxRateId: string,
  input: Omit<UpdateTaxRateInput, "rate"> & { ratePercent?: string },
): Promise<TaxRateActionResult<TaxRate>> {
  const { ratePercent, ...rest } = input;
  const rate = ratePercent === undefined ? undefined : percentToFraction(ratePercent);
  if (rate === null) return { ok: false, code: "generic" };
  const requestOptions = await getTenantServerApiRequestOptions();
  return run(() =>
    webAdminApi.tenant.taxRates.update(
      taxRateId,
      { ...rest, name: rest.name?.trim(), rate },
      requestOptions,
    ),
  );
}

export async function deleteTaxRateAction(
  taxRateId: string,
): Promise<TaxRateActionResult<null>> {
  const requestOptions = await getTenantServerApiRequestOptions();
  return run(async () => {
    await webAdminApi.tenant.taxRates.remove(taxRateId, requestOptions);
    return null;
  });
}
