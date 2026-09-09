"use server";

import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { getAuthSessionQuery } from "@/features/auth/queries";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { PointOfSaleSettings } from "../types";

export type TaxSettingsInput = {
  version: number;
  taxEnabled: boolean;
  pricesIncludeTax: boolean;
  defaultTaxRate: string;
  taxRegistrationNumber: string | null;
};

type TaxSettingsActionResult =
  | { ok: true; data: PointOfSaleSettings }
  | { ok: false; message: string };

export async function updateTaxSettingsAction(
  input: TaxSettingsInput,
): Promise<TaxSettingsActionResult> {
  const requestOptions = await getTenantServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!authContext || authContext.role !== "owner" || !authContext.tenantId) {
    return {
      ok: false,
      message: "Only tenant owners can update tax settings.",
    };
  }

  const rate = Number(input.defaultTaxRate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    return { ok: false, message: "VAT rate must be between 0% and 100%." };
  }

  const registrationNumber = input.taxRegistrationNumber?.trim() || null;
  if (registrationNumber && registrationNumber.length > 120) {
    return { ok: false, message: "Tax registration number is too long." };
  }

  try {
    const settings = await webAdminApi.tenant.posChannel.updateSettings(
      {
        version: input.version,
        taxEnabled: input.taxEnabled,
        pricesIncludeTax: input.pricesIncludeTax,
        defaultTaxRate: input.defaultTaxRate,
        taxRegistrationNumber: registrationNumber,
      },
      requestOptions,
    );
    revalidatePath(webAdminRoutes.tenant.system.settingsSections.pricing);
    revalidatePath(webAdminRoutes.tenant.system.settingsSections.pointOfSale);

    return { ok: true, data: settings };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Tax settings could not be saved.",
    };
  }
}
