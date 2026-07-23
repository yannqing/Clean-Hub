import { ApiHttpError } from "@cleanhub/api-client";

export type PosOrderErrorCode =
  | "FORBIDDEN"
  | "ORDER_NOT_FOUND"
  | "ORDER_ITEM_NOT_FOUND"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_NOT_SUPPORTED"
  | "PAYMENT_REFERENCE_CONFLICT"
  | "PAYMENT_AMOUNT_EXCEEDED"
  | "PAYMENT_ALREADY_PENDING"
  | "PAYMENT_ALREADY_RESOLVED"
  | "PAYMENT_CONFIRMATION_FORBIDDEN"
  | "CUSTOMER_NOT_FOUND"
  | "CUSTOMER_DISABLED"
  | "SERVICE_TICKET_NOT_FOUND"
  | "SERVICE_TICKET_EMPTY"
  | "TICKET_ITEM_ALREADY_ORDERED"
  | "INVALID_STATUS_TRANSITION"
  | "ORDER_ALREADY_PAID"
  | "ORDER_NOT_PAID"
  | "ORDER_CANNOT_BE_DELETED"
  | "VERSION_CONFLICT"
  | "VALIDATION_ERROR";

export type OrderActionResult<TPayload = unknown> = {
  ok: boolean;
  message: string;
  code?: PosOrderErrorCode;
  status?: number;
  data?: TPayload;
};

const ORDER_ERROR_MESSAGES: Record<PosOrderErrorCode, string> = {
  FORBIDDEN: "当前账号没有执行此操作的权限。",
  ORDER_NOT_FOUND: "订单不存在或已被删除。",
  ORDER_ITEM_NOT_FOUND: "订单条目不存在。",
  PAYMENT_NOT_FOUND: "支付流水不存在。",
  PAYMENT_NOT_SUPPORTED: "当前支付流水不支持此操作。",
  PAYMENT_REFERENCE_CONFLICT: "该交易流水号已被记录，请核对后重试。",
  PAYMENT_AMOUNT_EXCEEDED: "调整金额超过当前可处理余额。",
  PAYMENT_ALREADY_PENDING: "请先处理当前待确认的移动支付。",
  PAYMENT_ALREADY_RESOLVED: "该支付已经处理，请刷新页面。",
  PAYMENT_CONFIRMATION_FORBIDDEN: "只有 Owner 或 Manager 可以确认移动支付。",
  CUSTOMER_NOT_FOUND: "客户档案不存在。",
  CUSTOMER_DISABLED: "客户已停用，无法创建订单。",
  SERVICE_TICKET_NOT_FOUND: "关联工单不存在。",
  SERVICE_TICKET_EMPTY: "工单至少需要一个项目才能创建订单。",
  TICKET_ITEM_ALREADY_ORDERED: "部分工单项目已生成过订单。",
  INVALID_STATUS_TRANSITION: "当前订单状态不允许此操作。",
  ORDER_ALREADY_PAID: "订单已收款，不能执行该操作。",
  ORDER_NOT_PAID: "订单未结清，不能交付。",
  ORDER_CANNOT_BE_DELETED: "该订单不能删除。",
  VERSION_CONFLICT: "订单已被他人修改，请刷新后重试。",
  VALIDATION_ERROR: "提交内容校验未通过，请检查表单。",
};

export async function runOrderAction<TPayload>(
  task: () => Promise<TPayload>,
): Promise<OrderActionResult<TPayload>> {
  try {
    const data = await task();
    return { ok: true, message: "操作成功。", data };
  } catch (error) {
    if (error instanceof ApiHttpError) {
      const code = error.code as PosOrderErrorCode | undefined;
      return {
        ok: false,
        message:
          (code && ORDER_ERROR_MESSAGES[code]) ||
          error.message ||
          "操作失败，请稍后重试。",
        code,
        status: error.status,
      };
    }

    const message = error instanceof Error ? error.message : "操作失败，请稍后重试。";
    return { ok: false, message };
  }
}
