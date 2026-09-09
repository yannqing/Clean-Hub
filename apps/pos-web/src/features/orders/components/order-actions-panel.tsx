"use client";

import { posToast as toast } from "@/lib/pos-toast";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  ApiNetworkError,
  type CreatePosPaymentRequest,
  type PosMobileMoneyProvider,
  type PosOrderDetail,
  type PosOrderStatus,
  type PosPaymentTransaction,
  type PosRegisterState,
  type ShiftRecord,
} from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@cleanhub/ui";

import { Icon } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";
import { usePosOfflineWrites } from "@/features/offline/lib";
import { getPosHardwareBridge } from "@/features/hardware/lib/desktop-bridge";
import {
  openCashDrawerForPayment,
  openCashDrawerForPaymentOnce,
} from "@/features/hardware/lib/cash-drawer";
import { loadPosHardwareDevices } from "@/features/hardware/lib/hardware-device-cache";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { getPosApiErrorMessage } from "@/lib/api-error-message";
import { posApi } from "@/lib/api-client";

import { deleteOrderAction, payOrderAction } from "../actions";
import {
  formatOrderMoney,
  MOBILE_MONEY_PROVIDER_LABELS,
  ORDER_STATUS_LABELS,
} from "../constants";

type PaymentOption = "cash" | PosMobileMoneyProvider;

const STATUS_TRANSITIONS: Record<PosOrderStatus, PosOrderStatus[]> = {
  draft: ["received", "cancelled"],
  received: ["cancelled"],
  paid: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function OrderActionsPanel({
  canManageSensitiveOperations,
  order,
  payments,
  currentShift,
  register,
}: {
  canManageSensitiveOperations: boolean;
  order: PosOrderDetail;
  payments: PosPaymentTransaction[];
  currentShift: ShiftRecord | null;
  register: PosRegisterState;
}) {
  const { locale } = useTranslation();
  const router = useRouter();
  const runtime = usePosRuntimeConfig();
  const text = (value: string) => translatePosText(value, locale);
  const { changeOrderStatus, payOrder } = usePosOfflineWrites();
  const [amount, setAmount] = useState(getOutstandingAmount(order));
  const [cashTendered, setCashTendered] = useState(getOutstandingAmount(order));
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("cash");
  const [externalReference, setExternalReference] = useState("");
  const [sensitiveAction, setSensitiveAction] = useState<
    "cancel" | "delete" | null
  >(null);
  const [sensitiveReason, setSensitiveReason] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const trackedCashMode = [
    "shared_drawer",
    "assigned_drawer",
    "cash_in_hand",
  ].includes(register.cashHandlingMode);
  const cashRegisterAvailable =
    register.cashHandlingMode !== "none" &&
    (register.cashHandlingMode === "untracked" ||
      Boolean(register.cashSession) ||
      (trackedCashMode && !register.requireOpeningFloat));

  const outstanding = getOutstandingAmount(order);
  const pendingManualPayment = payments.find(
    (payment) =>
      payment.paymentStatus === "pending" && payment.provider !== null,
  );
  const canPay =
    Number(outstanding) > 0 &&
    order.status !== "cancelled" &&
    order.status !== "delivered" &&
    !pendingManualPayment;
  const isZeroTotalReadyForConfirmation =
    Number(order.totalAmount) === 0 &&
    Number(order.paidAmount) === 0 &&
    order.paymentStatus === "paid" &&
    (order.status === "draft" || order.status === "received");
  const availableTransitions = isZeroTotalReadyForConfirmation
    ? [...STATUS_TRANSITIONS[order.status], "paid" as const]
    : STATUS_TRANSITIONS[order.status];
  const transitions = availableTransitions.filter(
    (status) => status !== "cancelled" || canManageSensitiveOperations,
  );
  const canDelete =
    canManageSensitiveOperations &&
    Number(order.paidAmount) === 0 &&
    ["draft", "received", "cancelled"].includes(order.status);

  function pay() {
    if (paymentOption === "cash" && !cashRegisterAvailable) {
      toast.error("请先在“班次与收银”中开启可用的钱箱会话。");
      return;
    }
    const reference = externalReference.trim();
    if (paymentOption !== "cash" && reference.length < 3) {
      toast.error("请输入 Wave / Orange Money 交易流水号。");
      return;
    }
    if (paymentOption === "cash") {
      if (Number(cashTendered) < Number(amount)) {
        toast.error("实收现金不能少于本次收款金额。");
        return;
      }
    }

    startTransition(async () => {
      // 幂等键在入队/提交前生成，离线入队时随 payload 持久化，重放复用同一个键。
      const idempotencyKey =
        idempotencyKeyRef.current ??
        (idempotencyKeyRef.current = createPaymentIdempotencyKey());
      const request: CreatePosPaymentRequest =
        paymentOption === "cash"
          ? {
              paymentMethod: "cash",
              amount,
              tenderedAmount: Number(cashTendered).toFixed(2),
              shiftId: currentShift?.id,
              registerSessionId: register.registerSession?.id,
              cashDrawerSessionId: register.cashSession?.id,
              occurredAt: new Date().toISOString(),
              idempotencyKey,
            }
          : {
              paymentMethod: "app",
              amount,
              provider: paymentOption,
              externalReference: reference,
              idempotencyKey,
            };

      let result: Awaited<ReturnType<typeof payOrder>>;
      try {
        // 在线仍走现有 server action 路径；请求本身失败（通常是断网）时转换为
        // 网络错误，让 usePosOfflineWrites 降级入队，联网后自动重放。
        result = await payOrder(order.id, request, async (input) => {
          let actionResult: Awaited<ReturnType<typeof payOrderAction>>;
          try {
            actionResult = await payOrderAction(order.id, input);
          } catch (error) {
            throw new ApiNetworkError("收款请求未能到达服务器。", {
              cause: error,
            });
          }
          if (!actionResult.ok) {
            throw new Error(actionResult.message);
          }
          return actionResult.data;
        });
      } catch (error) {
        toast.error(getPosApiErrorMessage(error, "收款失败，请重试。"));
        return;
      }

      if (result.queued) {
        if (
          paymentOption === "cash" &&
          runtime.tenantId &&
          runtime.branchId &&
          runtime.terminalId
        ) {
          const drawerOutcome = await openCashDrawerForPaymentOnce({
            paymentId: idempotencyKey,
            scope: {
              tenantId: runtime.tenantId,
              branchId: runtime.branchId,
              terminalId: runtime.terminalId,
            },
            loadDevices: () =>
              loadPosHardwareDevices({
                tenantId: runtime.tenantId!,
                branchId: runtime.branchId!,
                terminalId: runtime.terminalId!,
              }),
            hardware: getPosHardwareBridge(),
            reportResult: (drawerResult) =>
              posApi.pos.hardware.recordCashPaymentDrawerResult(drawerResult),
          });
          if (!drawerOutcome.opened) toast.warning(drawerOutcome.message);
        }
        toast.success("网络不可用，收款已保存，将在联网后自动提交。");
        idempotencyKeyRef.current = null;
        setExternalReference("");
        return;
      }

      if (paymentOption === "cash") {
        toast.success("现金收款已记录。");
        const paymentResult = result.data;

        if (
          paymentResult?.payment.paymentMethod === "cash" &&
          paymentResult.payment.paymentStatus === "paid" &&
          !paymentResult.idempotent
        ) {
          const drawerInput: Parameters<typeof openCashDrawerForPayment>[0] = {
            paymentId: paymentResult.payment.id,
            loadDevices: async () =>
              runtime.tenantId && runtime.branchId && runtime.terminalId
                ? loadPosHardwareDevices({
                    tenantId: runtime.tenantId,
                    branchId: runtime.branchId,
                    terminalId: runtime.terminalId,
                  })
                : (await posApi.pos.hardware.list()).data,
            hardware: getPosHardwareBridge(),
            reportResult: (drawerResult) =>
              posApi.pos.hardware.recordCashPaymentDrawerResult(drawerResult),
          };
          const drawerOutcome =
            runtime.tenantId && runtime.branchId && runtime.terminalId
              ? await openCashDrawerForPaymentOnce({
                  ...drawerInput,
                  scope: {
                    tenantId: runtime.tenantId,
                    branchId: runtime.branchId,
                    terminalId: runtime.terminalId,
                  },
                })
              : await openCashDrawerForPayment(drawerInput);

          if (drawerOutcome.opened) {
            toast.success("钱箱已自动打开。");
          } else {
            toast.error(`现金收款已记录，但${drawerOutcome.message}`);
          }

          if (drawerOutcome.auditWarning) {
            toast.warning(
              `钱箱操作结果暂未同步审计：${drawerOutcome.auditWarning}`,
            );
          }
        } else if (paymentResult?.idempotent) {
          toast.info("重复收款请求已确认，本次未重复打开钱箱。");
        } else if (!paymentResult) {
          toast.warning("收款已提交，但支付响应不完整，未执行自动开箱。");
        }
      } else {
        toast.success(
          `${MOBILE_MONEY_PROVIDER_LABELS[paymentOption]} 支付已记录，等待 Manager 确认。`,
        );
      }
      idempotencyKeyRef.current = null;
      setExternalReference("");
      router.refresh();
    });
  }

  function changeStatus(to: PosOrderStatus, reason?: string) {
    startTransition(async () => {
      try {
        const result = await changeOrderStatus(order.id, {
          to,
          reason,
          version: order.version,
        });
        toast.success(
          result.queued
            ? `网络不可用，「${ORDER_STATUS_LABELS[to]}」状态已加入同步队列。`
            : `订单状态已更新为「${ORDER_STATUS_LABELS[to]}」。`,
        );
        setSensitiveAction(null);
        setSensitiveReason("");
        if (!result.queued) router.refresh();
      } catch (error) {
        toast.error(getPosApiErrorMessage(error, "订单状态更新失败，请重试。"));
      }
    });
  }

  function remove(reason: string) {
    startTransition(async () => {
      const result = await deleteOrderAction(order.id, { reason });
      if (result.ok) {
        toast.success("订单已删除。");
        router.replace("/orders");
      } else {
        toast.error(result.message);
      }
    });
  }

  function submitSensitiveAction() {
    const reason = sensitiveReason.trim();
    if (!sensitiveAction || !reason) {
      toast.error("请填写操作原因。");
      return;
    }

    if (sensitiveAction === "cancel") {
      changeStatus("cancelled", reason);
      return;
    }

    remove(reason);
  }

  return (
    <section className="sticky top-4 border-y bg-background p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-foreground">订单操作</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            支付状态由成功流水自动累加计算。
          </p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" name="wallet-cards" />
      </div>

      <div className="mt-5 rounded-md bg-muted/40 p-4">
        <div className="grid gap-2 border-b pb-3 text-xs">
          <div className="flex items-center justify-between gap-3 text-muted-foreground">
            <span>{text("订单小计")}</span>
            <span className="font-semibold text-foreground">
              {formatOrderMoney(order.subtotalAmount, order.currency, locale)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-muted-foreground">
            <span>{text("优惠金额")}</span>
            <span className="font-semibold text-emerald-700">
              {Number(order.discountAmount) > 0 ? "−" : ""}
              {formatOrderMoney(order.discountAmount, order.currency, locale)}
            </span>
          </div>
          {Number(order.taxAmount) !== 0 ? (
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span>
                VAT {Number(order.taxRateSnapshot) * 100}%
                {order.pricesIncludeTax ? "（含税）" : ""}
              </span>
              <span className="font-semibold text-foreground">
                {formatOrderMoney(order.taxAmount, order.currency, locale)}
              </span>
            </div>
          ) : null}
          {order.taxExemptionReason ? (
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span>税务豁免</span>
              <span className="max-w-40 truncate font-semibold text-foreground">
                {order.taxExemptionReason}
              </span>
            </div>
          ) : null}
          {Number(order.roundingAdjustmentAmount) !== 0 ? (
            <div className="flex items-center justify-between gap-3 text-muted-foreground">
              <span>舍入调整</span>
              <span className="font-semibold text-foreground">
                {formatOrderMoney(
                  order.roundingAdjustmentAmount,
                  order.currency,
                  locale,
                )}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 text-foreground">
            <span className="font-semibold">{text("应付总额")}</span>
            <span className="text-sm font-semibold text-foreground">
              {formatOrderMoney(order.totalAmount, order.currency, locale)}
            </span>
          </div>
        </div>
        <div className="mt-3 text-xs font-medium text-muted-foreground">
          待收金额
        </div>
        <div className="mt-1 text-xl font-semibold text-foreground">
          {formatOrderMoney(outstanding, order.currency)}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(["cash", "wave", "orange_money"] satisfies PaymentOption[]).map(
            (option) => (
              <button
                className={`min-h-11 rounded-md border px-3 text-sm font-semibold transition ${
                  paymentOption === option
                    ? "border-foreground bg-foreground text-background"
                    : "bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                disabled={
                  !canPay ||
                  isPending ||
                  (option === "cash" && !cashRegisterAvailable)
                }
                key={option}
                onClick={() => {
                  setPaymentOption(option);
                  setExternalReference("");
                  if (option === "cash") setCashTendered(amount);
                  idempotencyKeyRef.current = null;
                }}
                type="button"
              >
                {option === "cash"
                  ? "现金"
                  : MOBILE_MONEY_PROVIDER_LABELS[option]}
              </button>
            ),
          )}
        </div>

        {pendingManualPayment ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
            当前订单已有一笔
            {pendingManualPayment.provider
              ? ` ${MOBILE_MONEY_PROVIDER_LABELS[pendingManualPayment.provider]} `
              : "移动支付"}
            待确认。处理完成前不能继续收款。
          </div>
        ) : paymentOption !== "cash" ? (
          <div className="mt-3 rounded-md border bg-accent/60 p-3 text-xs leading-5 text-accent-foreground">
            客户需先在外部应用完成转账。这里只记录付款凭证，不会自动扣款；Owner
            或 Manager 核对商户账户后才能确认到账。
          </div>
        ) : null}

        {isZeroTotalReadyForConfirmation ? (
          <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
            {text("当前订单应付金额为 0。确认零元订单后即可继续完成交付。")}
          </div>
        ) : null}

        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
          <input
            className="h-11 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={!canPay || isPending}
            inputMode="decimal"
            onChange={(event) => {
              setAmount(event.target.value);
              idempotencyKeyRef.current = null;
            }}
            value={amount}
          />
          {paymentOption !== "cash" ? (
            <input
              className="h-11 min-w-0 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={!canPay || isPending}
              maxLength={120}
              onChange={(event) => {
                setExternalReference(event.target.value);
                idempotencyKeyRef.current = null;
              }}
              placeholder="交易流水号"
              value={externalReference}
            />
          ) : (
            <input
              className="h-11 min-w-0 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={!canPay || isPending || !cashRegisterAvailable}
              inputMode="decimal"
              min={0}
              onChange={(event) => {
                setCashTendered(event.target.value);
                idempotencyKeyRef.current = null;
              }}
              placeholder="实收现金"
              step="0.01"
              type="number"
              value={cashTendered}
            />
          )}
          <button
            className={`flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              paymentOption === "cash"
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-amber-600 text-white hover:bg-amber-700"
            }`}
            disabled={
              !canPay ||
              isPending ||
              Number(amount) <= 0 ||
              (paymentOption === "cash" &&
                (!cashRegisterAvailable ||
                  Number(cashTendered) < Number(amount))) ||
              (paymentOption !== "cash" && externalReference.trim().length < 3)
            }
            onClick={pay}
            type="button"
          >
            <Icon className="h-4 w-4" name="wallet-cards" />
            {paymentOption === "cash"
              ? "现金收款"
              : `记录 ${MOBILE_MONEY_PROVIDER_LABELS[paymentOption]}`}
          </button>
        </div>
        {paymentOption === "cash" ? (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {cashRegisterAvailable
                ? "现金找零"
                : "请先开班后再进行现金收款"}
            </span>
            {cashRegisterAvailable ? (
              <strong className="text-foreground">
                {formatOrderMoney(
                  Math.max(
                    0,
                    Number(cashTendered || 0) - Number(amount),
                  ).toFixed(2),
                  order.currency,
                  locale,
                )}
              </strong>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-5 grid gap-2">
        {transitions.length === 0 ? (
          <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            当前状态无可用流转。
          </div>
        ) : (
          transitions.map((status) => (
            <button
              className="flex h-11 items-center justify-between rounded-md border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isPending}
              key={status}
              onClick={() => {
                if (status === "cancelled") {
                  setSensitiveAction("cancel");
                  return;
                }
                changeStatus(status);
              }}
              type="button"
            >
              <span>
                {status === "paid" && isZeroTotalReadyForConfirmation
                  ? text("确认零元订单")
                  : `设为 ${ORDER_STATUS_LABELS[status]}`}
              </span>
              <Icon
                className="h-4 w-4 text-muted-foreground"
                name="chevron-right"
              />
            </button>
          ))
        )}

        <button
          className="mt-2 flex h-11 items-center justify-center gap-2 rounded-md border border-destructive/30 px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canDelete || isPending}
          onClick={() => setSensitiveAction("delete")}
          type="button"
        >
          <Icon className="h-4 w-4" name="trash" />
          删除订单
        </button>
      </div>

      <Dialog
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setSensitiveAction(null);
            setSensitiveReason("");
          }
        }}
        open={sensitiveAction !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {sensitiveAction === "delete" ? "删除订单" : "取消订单"}
            </DialogTitle>
            <DialogDescription>
              此操作仅限 Owner 或 Manager，并会记录操作原因和审计信息。
            </DialogDescription>
          </DialogHeader>
          <label className="grid gap-2 text-sm font-medium text-foreground">
            操作原因
            <textarea
              className="min-h-24 rounded-md border bg-background px-3 py-2 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
              disabled={isPending}
              maxLength={500}
              onChange={(event) => setSensitiveReason(event.target.value)}
              placeholder="填写取消或删除原因"
              value={sensitiveReason}
            />
          </label>
          <DialogFooter>
            <button
              className="h-11 rounded-md border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              disabled={isPending}
              onClick={() => {
                setSensitiveAction(null);
                setSensitiveReason("");
              }}
              type="button"
            >
              返回
            </button>
            <button
              className="h-11 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
              disabled={isPending || !sensitiveReason.trim()}
              onClick={submitSensitiveAction}
              type="button"
            >
              {isPending ? "处理中…" : "确认"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function getOutstandingAmount(order: PosOrderDetail): string {
  return Math.max(
    0,
    Number(order.totalAmount) - Number(order.paidAmount),
  ).toFixed(2);
}

function createPaymentIdempotencyKey(): string {
  return createId();
}
