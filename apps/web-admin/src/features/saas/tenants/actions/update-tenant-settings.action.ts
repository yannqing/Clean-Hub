"use server";

import type { AuthContext } from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

import type { TenantSettings, TenantSettingsFormValues } from "../types";
import { validateTenantSettingsForm } from "../validators";
import { getTenantSettingsActionErrorResult } from "./tenant-action-errors";

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

const FORBIDDEN_MESSAGE =
  "Tenant settings updates require Super Admin or SaaS tenant write permission.";

function canWriteTenant(authContext: AuthContext): boolean {
  return Boolean(
    authContext.tenantId === null &&
      (authContext.role === "super_admin" ||
        authContext.permissions.includes("saas:tenant:write")),
  );
}

export async function updateTenantSettingsAction(
  tenantId: string,
  input: TenantSettingsFormValues,
): Promise<TenantSettingsActionResult> {
  const requestOptions = await getSaasServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!authContext || !canWriteTenant(authContext)) {
    return {
      ok: false,
      errors: {},
      message: FORBIDDEN_MESSAGE,
    };
  }

  const validation = validateTenantSettingsForm(input);

  if (!validation.ok) {
    return {
      ...validation,
      message: "Please correct the highlighted fields.",
    };
  }

  try {
    const settings = await webAdminApi.saas.tenants.updateSettings(
      tenantId,
      validation.data,
      requestOptions,
    );

    revalidatePath("/saas");
    revalidatePath("/saas/tenants");
    revalidatePath(`/saas/tenants/${tenantId}`);
    revalidatePath(`/saas/tenants/${tenantId}/settings`);

    return {
      ok: true,
      data: settings,
    };
  } catch (error) {
    return getTenantSettingsActionErrorResult(error);
  }
}
