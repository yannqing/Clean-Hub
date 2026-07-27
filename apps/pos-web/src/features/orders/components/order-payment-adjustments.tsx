"use client";

import type {
  PosOrderDetail,
  PosPaymentAdjustment,
  PosPaymentAdjustmentDirection,
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
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { Icon } from "@/components/app-shell";
import { posToast as toast } from "@/lib/pos-toast";

import { createPaymentCorrectionAction, createRefundAction } from "../actions";
import { formatOrderDateTime, formatOrderMoney } from "../constants";

type AdjustmentMode = "refund" | "correction";

export function OrderPaymentAdjustments({
  adjustments,
  canManage,
  order,
  payments,
}: {
  adjustments: PosPaymentAdjustment[];
  canManage: boolean;
  order: PosOrderDetail;
  payments: PosPaymentTransaction[];
}) {
  const { locale } = useTranslation();
  const router = useRouter();
  const idempotencyKeyRef = useRef<string | null>(null);
  const [mode, setMode] = useState<AdjustmentMode | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [direction, setDirection] =
    useState<PosPaymentAdjustmentDirection>("debit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const refundablePayments = useMemo(() => {
    return payments
      .filter((payment) => payment.paymentStatus === "paid")
      .map((payment) => {
        const refunded = adjustments
          .filter(
            (adjustment) =>
              adjustment.adjustmentType === "refund" &&
              adjustment.originalPaymentId === payment.id,
          )
          .reduce((sum, adjustment) => sum + Number(adjustment.amount), 0);
        return {
          payment,
          remaining: Math.max(0, Number(payment.amount) - refunded),
        };
      })
      .filter(({ remaining }) => remaining > 0);
  }, [adjustments, payments]);
  const paidPayments = useMemo(
    () => payments.filter((payment) => payment.paymentStatus === "paid"),
    [payments],
  );

  const selectedRefund = refundablePayments.find(
    ({ payment }) => payment.id === selectedPaymentId,
  );

  function resetIntent(): void {
    idempotencyKeyRef.current = null;
  }

  function open(nextMode: AdjustmentMode): void {
    resetIntent();
    setMode(nextMode);
    setDirection("debit");
    setReason("");
    if (nextMode === "refund") {
      const first = refundablePayments[0];
      setSelectedPaymentId(first?.payment.id ?? "");
      setAmount(first ? first.remaining.toFixed(2) : "");
    } else {
      setSelectedPaymentId(paidPayments[0]?.id ?? "");
      setAmount("");
    }
  }

  function close(): void {
    if (isPending) return;
    setMode(null);
    setAmount("");
    setReason("");
    resetIntent();
  }

  function submit(): void {
    const normalizedAmount = Number(amount);
    const normalizedReason = reason.trim();
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      toast.error("请输入有效的调整金额。");
      return;
    }
    if (!normalizedReason) {
      toast.error("请填写操作原因。");
      return;
    }
    if (mode === "refund" && !selectedRefund) {
      toast.error("请选择仍有可退余额的支付流水。");
      return;
    }
    if (mode === "correction" && !selectedPaymentId) {
      toast.error("请选择要修正的原始支付流水。");
      return;
    }
    if (mode === "refund" && normalizedAmount > selectedRefund!.remaining) {
      toast.error("退款金额不能超过该支付流水的可退余额。");
      return;
    }

    const idempotencyKey =
      idempotencyKeyRef.current ?? (idempotencyKeyRef.current = createId());

    startTransition(async () => {
      const result =
        mode === "refund"
          ? await createRefundAction({
              orderId: order.id,
              originalPaymentId: selectedRefund!.payment.id,
              amount: normalizedAmount.toFixed(2),
              idempotencyKey,
              reason: normalizedReason,
            })
          : await createPaymentCorrectionAction({
              orderId: order.id,
              originalPaymentId: selectedPaymentId,
              direction,
              amount: normalizedAmount.toFixed(2),
              idempotencyKey,
              reason: normalizedReason,
            });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(mode === "refund" ? "退款已记录。" : "支付修正已记录。");
      setMode(null);
      setAmount("");
      setReason("");
      resetIntent();
      router.refresh();
    });
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-950">退款与支付修正</h2>
          <p className="mt-1 text-xs text-slate-500">不可变支付调整记录</p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <button
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={refundablePayments.length === 0}
              onClick={() => open("refund")}
              type="button"
            >
              <Icon className="h-4 w-4" name="rotate-ccw" />
              退款
            </button>
            <button
              className="flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={paidPayments.length === 0}
              onClick={() => open("correction")}
              type="button"
            >
              <Icon className="h-4 w-4" name="replace" />
              支付修正
            </button>
          </div>
        ) : null}
      </div>

      {adjustments.length === 0 ? (
        <div className="px-5 py-8 text-sm text-slate-400">暂无调整记录。</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {adjustments.map((adjustment) => (
            <div
              className="flex flex-wrap items-start justify-between gap-4 px-5 py-4 text-sm"
              key={adjustment.id}
            >
              <div className="min-w-0">
                <div className="font-semibold text-slate-800">
                  {adjustment.adjustmentType === "refund"
                    ? "退款"
                    : adjustment.direction === "debit"
                      ? "减少实收"
                      : "增加实收"}
                </div>
                <div className="mt-1 break-words text-xs text-slate-500">
                  {adjustment.reason}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  {formatOrderDateTime(adjustment.occurredAt, locale)}
                </div>
              </div>
              <div
                className={`font-semibold ${
                  adjustment.direction === "debit"
                    ? "text-red-600"
                    : "text-emerald-700"
                }`}
              >
                {adjustment.direction === "debit" ? "-" : "+"}
                {formatOrderMoney(adjustment.amount, adjustment.currency)}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        onOpenChange={(openState) => {
          if (!openState) close();
        }}
        open={mode !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "refund" ? "记录退款" : "记录支付修正"}
            </DialogTitle>
            <DialogDescription>
              仅限 Owner 或 Manager，提交后会保留原因与操作审计。
            </DialogDescription>
          </DialogHeader>

          {mode === "refund" ? (
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              原始支付流水
              <select
                className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-300"
                disabled={isPending}
                onChange={(event) => {
                  const paymentId = event.target.value;
                  const selected = refundablePayments.find(
                    ({ payment }) => payment.id === paymentId,
                  );
                  setSelectedPaymentId(paymentId);
                  setAmount(selected ? selected.remaining.toFixed(2) : "");
                  resetIntent();
                }}
                value={selectedPaymentId}
              >
                {refundablePayments.map(({ payment, remaining }) => (
                  <option key={payment.id} value={payment.id}>
                    {payment.id.slice(-8)} · 可退{" "}
                    {formatOrderMoney(remaining, payment.currency)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                原始支付流水
                <select
                  className="h-11 rounded-lg border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-300"
                  disabled={isPending}
                  onChange={(event) => {
                    setSelectedPaymentId(event.target.value);
                    resetIntent();
                  }}
                  value={selectedPaymentId}
                >
                  {paidPayments.map((payment) => (
                    <option key={payment.id} value={payment.id}>
                      {payment.id.slice(-8)} ·{" "}
                      {formatOrderMoney(payment.amount, payment.currency)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-sm font-medium text-slate-700">修正方向</div>
              <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {(["debit", "credit"] as const).map((value) => (
                  <button
                    className={`h-9 rounded-md text-sm font-semibold transition ${
                      direction === value
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-500"
                    }`}
                    disabled={isPending}
                    key={value}
                    onClick={() => {
                      setDirection(value);
                      resetIntent();
                    }}
                    type="button"
                  >
                    {value === "debit" ? "减少实收" : "增加实收"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            金额
            <input
              className="h-11 rounded-lg border border-slate-200 px-3 font-normal outline-none focus:border-blue-300"
              disabled={isPending}
              inputMode="decimal"
              onChange={(event) => {
                setAmount(event.target.value);
                resetIntent();
              }}
              placeholder="0.00"
              value={amount}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            操作原因
            <textarea
              className="min-h-24 rounded-lg border border-slate-200 px-3 py-2 font-normal outline-none focus:border-blue-300"
              disabled={isPending}
              maxLength={500}
              onChange={(event) => {
                setReason(event.target.value);
                resetIntent();
              }}
              placeholder="填写退款或修正原因"
              value={reason}
            />
          </label>

          <DialogFooter>
            <button
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              disabled={isPending}
              onClick={close}
              type="button"
            >
              取消
            </button>
            <button
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isPending || !reason.trim() || Number(amount) <= 0}
              onClick={submit}
              type="button"
            >
              {isPending ? "提交中…" : "确认提交"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
