"use server";

import {
  isApiHttpError,
  type TenantCustomerTimelineItem,
  type UpdateTenantCustomerCommentRequest,
} from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

export async function updateTenantCustomerCommentAction(
  customerId: string,
  commentId: string,
  input: UpdateTenantCustomerCommentRequest,
): Promise<
  | { ok: true; data: TenantCustomerTimelineItem }
  | { ok: false; message: string }
> {
  try {
    const data = await webAdminApi.tenant.customers.updateComment(
      customerId,
      commentId,
      input,
      await getTenantServerApiRequestOptions(),
    );
    revalidatePath(webAdminRoutes.tenant.customer(customerId));
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      message: isApiHttpError(error)
        ? error.message
        : "The comment could not be updated.",
    };
  }
}
