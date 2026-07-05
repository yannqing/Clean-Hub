"use server";

import type { AuthContext } from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { getAuthSessionQuery } from "@/features/auth/queries";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

import type { TenantDetail, TenantFormValues } from "../types";
import { validateTenantUpdateForm } from "../validators";
import { getTenantFormActionErrorResult } from "./tenant-action-errors";

type UpdateTenantActionResult =
  | {
      ok: true;
      data: TenantDetail;
    }
  | {
      ok: false;
      errors: Partial<Record<keyof TenantFormValues, string>>;
      message: string;
    };

const FORBIDDEN_MESSAGE =
  "Tenant updates require Super Admin or SaaS tenant write permission.";

function canWriteTenant(authContext: AuthContext): boolean {
  return Boolean(
    authContext.tenantId === null &&
      (authContext.role === "super_admin" ||
        authContext.permissions.includes("saas:tenant:write")),
  );
}

export async function updateTenantAction(
  tenantId: string,
  input: TenantFormValues,
): Promise<UpdateTenantActionResult> {
  const requestOptions = await getSaasServerApiRequestOptions();
  const authContext = await getAuthSessionQuery(requestOptions);

  if (!authContext || !canWriteTenant(authContext)) {
    return {
      ok: false,
      errors: {},
      message: FORBIDDEN_MESSAGE,
    };
  }

  const validation = validateTenantUpdateForm(input);

  if (!validation.ok) {
    return {
      ...validation,
      message: "Please correct the highlighted fields.",
    };
  }

  try {
    const tenant = await webAdminApi.saas.tenants.update(
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
      data: tenant,
    };
  } catch (error) {
    return getTenantFormActionErrorResult(error, {
      fallbackMessage: "Tenant could not be updated.",
      forbiddenMessage: FORBIDDEN_MESSAGE,
      notFoundMessage: "Tenant was not found.",
    });
  }
}
