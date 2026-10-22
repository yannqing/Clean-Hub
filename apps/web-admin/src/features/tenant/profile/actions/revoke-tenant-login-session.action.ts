"use server";

import { isApiHttpError } from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { webAdminApi } from "@/lib/api-client";

import { getTenantServerApiRequestOptions } from "../../server/api-request-options";
import type { TenantLoginSessionActionErrorCode } from "../types";

type RevokeTenantLoginSessionActionResult =
  | { ok: true; sessionId: string }
  | { ok: false; code: TenantLoginSessionActionErrorCode };

function getActionErrorCode(error: unknown): TenantLoginSessionActionErrorCode {
  if (
    isApiHttpError(error) &&
    (error.code === "TENANT_LOGIN_SESSION_NOT_FOUND" ||
      error.code === "TENANT_CURRENT_SESSION_REVOKE_FORBIDDEN")
  ) {
    return error.code;
  }

  return "UNKNOWN";
}

export async function revokeTenantLoginSessionAction(
  sessionId: string,
): Promise<RevokeTenantLoginSessionActionResult> {
  try {
    const result = await webAdminApi.tenant.profile.revokeSession(
      sessionId,
      await getTenantServerApiRequestOptions(),
    );

    revalidatePath(webAdminRoutes.tenant.profile);
    return { ok: true, sessionId: result.id };
  } catch (error) {
    return { ok: false, code: getActionErrorCode(error) };
  }
}
