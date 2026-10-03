"use server";

import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { getAuthSessionQuery } from "@/features/auth/queries";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { PointOfSaleSettings } from "../types";

export type TaxSettingsInput = {
  version: number;
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

  const registrationNumber = input.taxRegistrationNumber?.trim() || null;
  if (registrationNumber && registrationNumber.length > 200) {
    return { ok: false, message: "Tax registration number is too long." };
  }

  try {
    const settings = await webAdminApi.tenant.posChannel.updateSettings(
      {
        version: input.version,
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
