"use server";

import {
  isApiHttpError,
  type TenantOrderTimelineItem,
} from "@cleanhub/api-client";
import { revalidatePath } from "next/cache";

import { webAdminRoutes } from "@/config/routes";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { webAdminApi } from "@/lib/api-client";

export type CreateTenantOrderCommentActionResult =
  | { ok: true; data: TenantOrderTimelineItem }
  | { ok: false; code?: string; message: string; status?: number };

export async function createTenantOrderCommentAction(
  orderId: string,
  input: {
    body: string;
    idempotencyKey: string;
    mentionedUserIds?: string[];
    attachments?: Array<{ objectKey: string; fileName: string }>;
  },
): Promise<CreateTenantOrderCommentActionResult> {
  try {
    const data = await webAdminApi.tenant.orders.createComment(
      orderId,
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

    return { ok: false, message: "The comment could not be posted." };
  }
}
