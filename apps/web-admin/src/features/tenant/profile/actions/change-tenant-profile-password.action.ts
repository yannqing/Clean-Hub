"use server";

import { isApiHttpError } from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { TenantProfileActionErrorCode } from "../types";

type ChangeTenantProfilePasswordActionResult =
  | {
      ok: true;
      sessionsRevoked: number;
    }
  | {
      ok: false;
      code: TenantProfileActionErrorCode;
    };

function getActionErrorCode(error: unknown): TenantProfileActionErrorCode {
  if (isApiHttpError(error) && error.code) {
    return error.code as TenantProfileActionErrorCode;
  }

  return "UNKNOWN";
}

export async function changeTenantProfilePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<ChangeTenantProfilePasswordActionResult> {
  if (!input.currentPassword) {
    return { ok: false, code: "currentPasswordRequired" };
  }

  if (!input.newPassword) {
    return { ok: false, code: "newPasswordRequired" };
  }

  try {
    const result = await webAdminApi.tenant.profile.changePassword(
      input,
      await getTenantServerApiRequestOptions(),
    );

    return {
      ok: true,
      sessionsRevoked: result.sessionsRevoked,
    };
  } catch (error) {
    return {
      ok: false,
      code: getActionErrorCode(error),
    };
  }
}

