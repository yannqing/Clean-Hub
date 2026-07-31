"use client";

import { posToast as toast } from "@/lib/pos-toast";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type {
  PosMobileMoneyProvider,
  PosOrderDetail,
  PosOrderStatus,
  PosPaymentTransaction,
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
import { getPosApiErrorMessage } from "@/lib/api-error-message";

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
}: {
  canManageSensitiveOperations: boolean;
  order: PosOrderDetail;
  payments: PosPaymentTransaction[];
}) {
  const { locale } = useTranslation();
  const router = useRouter();
  const text = (value: string) => translatePosText(value, locale);
  const { changeOrderStatus } = usePosOfflineWrites();
  const [amount, setAmount] = useState(getOutstandingAmount(order));
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("cash");
  const [externalReference, setExternalReference] = useState("");
  const [sensitiveAction, setSensitiveAction] = useState<
    "cancel" | "delete" | null
  >(null);
  const [sensitiveReason, setSensitiveReason] = useState("");
  const idempotencyKeyRef = useRef<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
    const reference = externalReference.trim();
    if (paymentOption !== "cash" && reference.length < 3) {
      toast.error("请输入 Wave / Orange Money 交易流水号。");
      return;
    }

    startTransition(async () => {
      const result =
        paymentOption === "cash"
          ? await payOrderAction(order.id, {
              paymentMethod: "cash",
              amount,
              idempotencyKey:
                idempotencyKeyRef.current ??
                (idempotencyKeyRef.current = createPaymentIdempotencyKey()),
            })
          : await payOrderAction(order.id, {
              paymentMethod: "app",
              amount,
              provider: paymentOption,
              externalReference: reference,
              idempotencyKey:
                idempotencyKeyRef.current ??
                (idempotencyKeyRef.current = createPaymentIdempotencyKey()),
            });
      if (result.ok) {
        toast.success(
          paymentOption === "cash"
            ? "现金收款已记录。"
            : `${MOBILE_MONEY_PROVIDER_LABELS[paymentOption]} 支付已记录，等待 Manager 确认。`,
        );
        idempotencyKeyRef.current = null;
        setExternalReference("");
        router.refresh();
      } else {
        toast.error(result.message);
      }
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
                disabled={!canPay || isPending}
                key={option}
                onClick={() => {
                  setPaymentOption(option);
                  setExternalReference("");
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
            <div className="hidden sm:block" />
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
