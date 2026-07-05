"use server";

import type { AuthContext } from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { getSecuritySettingsQuery } from "@/features/saas/security/queries";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

import type { CreateTenantResponse, TenantFormValues } from "../types";
import { validateTenantForm } from "../validators";
import { getTenantFormActionErrorResult } from "./tenant-action-errors";

type CreateTenantActionResult =
  | {
      ok: true;
      data: CreateTenantResponse;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantFormValues, string>>;
      message: string;
    };

const FORBIDDEN_MESSAGE = "Only super admins can create tenants.";

function isSuperAdminWithoutTenant(authContext: AuthContext): boolean {
  return authContext.role === "super_admin" && authContext.tenantId === null;
}

export async function createTenantAction(
  input: TenantFormValues,
): Promise<CreateTenantActionResult> {
  const requestOptions = await getSaasServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!authContext || !isSuperAdminWithoutTenant(authContext)) {
    return {
      ok: false,
      errors: {},
      message: FORBIDDEN_MESSAGE,
    };
  }

  const passwordPolicy = await getSecuritySettingsQuery(requestOptions);
  const validation = validateTenantForm(input, passwordPolicy);

  if (!validation.ok) {
    return {
      ...validation,
      message: "Please correct the highlighted fields.",
    };
  }

  try {
    const tenant = await webAdminApi.saas.tenants.create(
      validation.data,
      requestOptions,
    );

    revalidatePath("/saas");
    revalidatePath("/saas/tenants");

    return {
      ok: true,
      data: tenant,
    };
  } catch (error) {
    return getTenantFormActionErrorResult(error, {
      fallbackMessage: "Tenant could not be created.",
      forbiddenMessage: FORBIDDEN_MESSAGE,
    });
  }
}
