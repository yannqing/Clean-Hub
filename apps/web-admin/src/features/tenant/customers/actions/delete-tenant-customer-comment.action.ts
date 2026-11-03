"use server";

import { isApiHttpError } from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

export async function deleteTenantCustomerCommentAction(
  customerId: string,
  commentId: string,
  version: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await webAdminApi.tenant.customers.deleteComment(
      customerId,
      commentId,
      { version },
      await getTenantServerApiRequestOptions(),
    );
    revalidatePath(webAdminRoutes.tenant.customer(customerId));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: isApiHttpError(error)
        ? error.message
        : "The comment could not be deleted.",
    };
  }
}
