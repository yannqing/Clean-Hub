"use server";

import { revalidatePath } from "next/cache";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { TenantSettings, TenantSettingsFormValues } from "../types";
import { validateTenantSettingsForm } from "../validators";

type TenantSettingsActionResult =
  | {
      ok: true;
      data: TenantSettings;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantSettingsFormValues, string>>;
      message: string;
    };

const OWNER_ONLY_MESSAGE = "Only tenant owners can update tenant settings.";

function getActionErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Tenant settings could not be updated.";
}

export async function updateTenantSettingsAction(
  input: TenantSettingsFormValues,
): Promise<TenantSettingsActionResult> {
  const requestOptions = await getTenantServerApiRequestOptions();

  const authContext = await getAuthSessionQuery(requestOptions);

  if (!authContext || authContext.role !== "owner" || !authContext.tenantId) {
    return {
      ok: false,
      errors: {},
      message: OWNER_ONLY_MESSAGE,
    };
  }

  const validation = validateTenantSettingsForm(input);

  if (!validation.ok) {
    return {
      ...validation,
      message: validation.message ?? "Check the tenant settings form.",
    };
  }

  try {
    const settings = await webAdminApi.tenant.settings.update(
      validation.data,
      requestOptions,
    );

    revalidatePath("/tenant/system/settings");
    revalidatePath("/tenant/system/preferences");

    return {
      ok: true,
      data: settings,
    };
  } catch (error) {
    return {
      ok: false,
      errors: {},
      message: getActionErrorMessage(error),
    };
  }
}
