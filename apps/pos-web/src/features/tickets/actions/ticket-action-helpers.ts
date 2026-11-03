import {
  ApiHttpError,
  type ServiceTicketErrorCode,
} from "@cleanhub/api-client";

import type { ServiceTicketStatus } from "@cleanhub/api-client";

/**
 * Pure helpers shared by the ticket server actions. This module is referenced
 * from `"use server"` action files, which Next.js can call from client
 * components — so it must NOT import `next/cache` or carry the `server-only`
 * marker. The `revalidatePath` side effects live in
 * `./ticket-action-revalidate.ts` (server-only) and are only invoked inside
 * action bodies.
 */

export type TicketActionResult<TPayload = unknown> = {
  ok: boolean;
  /** Friendly message for the UI (toast). */
  message: string;
  /** Backend error code, surfaced for the UI to branch (e.g. version conflict). */
  code?: ServiceTicketErrorCode;
  /** HTTP status, for finer branching when needed. */
  status?: number;
  /** The updated/created entity, when the call succeeded. */
  data?: TPayload;
};

/**
 * Map a backend ServiceTicket error code to a Chinese user-facing message.
 * Mirrors §4 of the API doc. Safe to import from client components.
 */
export const TICKET_ERROR_MESSAGES: Record<ServiceTicketErrorCode, string> = {
  SERVICE_TICKET_NOT_FOUND: "工单不存在或已被删除。",
  SERVICE_TICKET_ITEM_NOT_FOUND: "工单项目不存在。",
  INVALID_STATUS_TRANSITION: "当前状态不允许此操作，请刷新工单后重试。",
  INVALID_ITEM_STATUS_TRANSITION: "项目状态不允许此操作。",
  CUSTOMER_NOT_FOUND: "客户档案不存在。",
  CUSTOMER_DISABLED: "客户已停用，无法继续操作。",
  BRANCH_NOT_ALLOWED: "你没有该门店的操作权限。",
  FEATURE_DISABLED: "租户未开通该业务线。",
  PICKUP_REQUIRES_SETTLEMENT: "取件前请先结清关联订单。",
  VERSION_CONFLICT: "该工单已被他人修改，请刷新后重试。",
  VALIDATION_ERROR: "提交内容校验未通过，请检查表单。",
};

/** Fallback message when the error has no recognized code. */
export const TICKET_DEFAULT_ERROR = "操作失败，请稍后重试。";

/** Whether a status change targets pickup (needs settlement check UX hint). */
export function isPickupTransition(to: ServiceTicketStatus): boolean {
  return to === "picked_up";
}

/**
 * Run an API mutation and normalize the outcome into a TicketActionResult.
 * Callers still forward cookies via `getPosServerApiRequestOptions()`.
 */
export async function runTicketAction<TPayload>(
  task: () => Promise<TPayload>,
): Promise<TicketActionResult<TPayload>> {
  try {
    const data = await task();
    return { ok: true, message: "操作成功。", data };
  } catch (error) {
    if (error instanceof ApiHttpError) {
      const code = error.code as ServiceTicketErrorCode | undefined;
      return {
        ok: false,
        message:
          (code && TICKET_ERROR_MESSAGES[code]) ||
          error.message ||
          TICKET_DEFAULT_ERROR,
        code,
        status: error.status,
      };
    }
    const message =
      error instanceof Error ? error.message : TICKET_DEFAULT_ERROR;
    return { ok: false, message };
  }
}
