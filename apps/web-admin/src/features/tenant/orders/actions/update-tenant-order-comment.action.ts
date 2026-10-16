"use server";

import {
  isApiHttpError,
  type TenantOrderTimelineItem,
  type UpdateTenantOrderCommentRequest,
} from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

export type UpdateTenantOrderCommentActionResult =
  | { ok: true; data: TenantOrderTimelineItem }
  | { ok: false; code?: string; message: string; status?: number };

export async function updateTenantOrderCommentAction(
  orderId: string,
  commentId: string,
  input: UpdateTenantOrderCommentRequest,
): Promise<UpdateTenantOrderCommentActionResult> {
  try {
    const data = await webAdminApi.tenant.orders.updateComment(
      orderId,
      commentId,
      input,
      await getTenantServerApiRequestOptions(),
    );
    revalidatePath(webAdminRoutes.tenant.order(orderId));
    return { ok: true, data };
  } catch (error) {
    if (isApiHttpError(error)) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        status: error.status,
      };
    }
    return { ok: false, message: "The comment could not be updated." };
  }
}
