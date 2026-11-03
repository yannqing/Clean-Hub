"use server";

import { isApiHttpError } from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

export type DeleteTenantOrderCommentActionResult =
  | { ok: true }
  | { ok: false; code?: string; message: string; status?: number };

export async function deleteTenantOrderCommentAction(
  orderId: string,
  commentId: string,
  version: number,
): Promise<DeleteTenantOrderCommentActionResult> {
  try {
    await webAdminApi.tenant.orders.deleteComment(
      orderId,
      commentId,
      { version },
      await getTenantServerApiRequestOptions(),
    );
    revalidatePath(webAdminRoutes.tenant.order(orderId));
    return { ok: true };
  } catch (error) {
    if (isApiHttpError(error)) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        status: error.status,
      };
    }
    return { ok: false, message: "The comment could not be deleted." };
  }
}
