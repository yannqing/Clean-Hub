"use server";

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

function getActionErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Tenant settings could not be updated.";
}

export async function updateTenantSettingsAction(
  input: TenantSettingsFormValues,
): Promise<TenantSettingsActionResult> {
  const validation = validateTenantSettingsForm(input);

  if (!validation.ok) {
    return {
      ...validation,
      message: validation.message ?? "Check the tenant settings form.",
    };
  }

  try {
    const settings = await webAdminApi.http.patch<TenantSettings>(
      "/tenant/settings",
      validation.data,
      await getTenantServerApiRequestOptions(),
    );

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
