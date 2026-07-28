"use server";

import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { getAuthSessionQuery } from "@/features/auth/queries";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { PointOfSaleSettings } from "../types";
import {
  validatePointOfSaleSettings,
  type PointOfSaleSettingsFormValues,
} from "../validators";

type UpdatePointOfSaleSettingsActionResult =
  | { ok: true; data: PointOfSaleSettings }
  | { ok: false; message: string };

export async function updatePointOfSaleSettingsAction(
  input: PointOfSaleSettingsFormValues,
): Promise<UpdatePointOfSaleSettingsActionResult> {
  const requestOptions = await getTenantServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!authContext || authContext.role !== "owner" || !authContext.tenantId) {
    return {
      ok: false,
      message: "Only tenant owners can update point-of-sale settings.",
    };
  }

  const validation = validatePointOfSaleSettings(input);

  if (!validation.ok) {
    return validation;
  }

  try {
    const settings = await webAdminApi.tenant.posChannel.updateSettings(
      validation.data,
      requestOptions,
    );
    revalidatePath(webAdminRoutes.tenant.pointOfSale.home);
    revalidatePath(webAdminRoutes.tenant.pointOfSale.settings);
    revalidatePath(webAdminRoutes.tenant.system.settingsSections.pointOfSale);

    return { ok: true, data: settings };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Point-of-sale settings could not be saved.",
    };
  }
}
