"use server";

import { isApiHttpError } from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type {
  TenantProfile,
  TenantProfileActionErrorCode,
  TenantProfileFormErrors,
  TenantProfileFormValues,
} from "../types";
import { validateTenantProfileForm } from "../validators";

type UpdateTenantProfileActionResult =
  | {
      ok: true;
      data: TenantProfile;
    }
  | {
      ok: false;
      code: TenantProfileActionErrorCode;
      errors: TenantProfileFormErrors;
    };

function getActionErrorCode(error: unknown): TenantProfileActionErrorCode {
  if (isApiHttpError(error) && error.code) {
    return error.code as TenantProfileActionErrorCode;
  }

  return "UNKNOWN";
}

export async function updateTenantProfileAction(
  input: TenantProfileFormValues,
): Promise<UpdateTenantProfileActionResult> {
  const validation = validateTenantProfileForm(input);

  if (!validation.ok) {
    return {
      ok: false,
      code: Object.values(validation.errors)[0] ?? "UNKNOWN",
      errors: validation.errors,
    };
  }

  try {
    const profile = await webAdminApi.tenant.profile.update(
      validation.data,
      await getTenantServerApiRequestOptions(),
    );

    revalidatePath(webAdminRoutes.tenant.profile);

    return { ok: true, data: profile };
  } catch (error) {
    return {
      ok: false,
      code: getActionErrorCode(error),
      errors: {},
    };
  }
}

