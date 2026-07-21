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

import { Icon } from "@/components/app-shell";

import {
  changeOrderStatusAction,
  deleteOrderAction,
  payOrderAction,
} from "../actions";
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
  order,
  payments,
}: {
  order: PosOrderDetail;
  payments: PosPaymentTransaction[];
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(getOutstandingAmount(order));
  const [paymentOption, setPaymentOption] = useState<PaymentOption>("cash");
  const [externalReference, setExternalReference] = useState("");
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
  const transitions = STATUS_TRANSITIONS[order.status];
  const canDelete =
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
            })
          : await payOrderAction(order.id, {
              paymentMethod: "app",
              amount,
              provider: paymentOption,
              externalReference: reference,
              idempotencyKey:
                idempotencyKeyRef.current ??
                (idempotencyKeyRef.current = createPaymentIdempotencyKey(
                  order.id,
                )),
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

  function changeStatus(to: PosOrderStatus) {
    startTransition(async () => {
      const result = await changeOrderStatusAction(order.id, {
        to,
        version: order.version,
      });
      if (result.ok) {
        toast.success(`订单状态已更新为「${ORDER_STATUS_LABELS[to]}」。`);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteOrderAction(order.id);
      if (result.ok) {
        toast.success("订单已删除。");
        router.replace("/orders");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">订单操作</h2>
          <p className="mt-1 text-xs text-slate-500">
            支付状态由成功流水自动累加计算。
          </p>
        </div>
        <Icon className="h-5 w-5 text-slate-300" name="wallet-cards" />
      </div>

      <div className="mt-5 rounded-lg bg-slate-50 p-4">
        <div className="text-xs font-medium text-slate-500">待收金额</div>
        <div className="mt-1 text-xl font-semibold text-slate-950">
          {formatOrderMoney(outstanding, order.currency)}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            ["cash", "wave", "orange_money"] satisfies PaymentOption[]
          ).map((option) => (
            <button
              className={`min-h-11 rounded-lg border px-3 text-sm font-semibold transition ${
                paymentOption === option
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-200"
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
          ))}
        </div>

        {pendingManualPayment ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            当前订单已有一笔
            {pendingManualPayment.provider
              ? ` ${MOBILE_MONEY_PROVIDER_LABELS[pendingManualPayment.provider]} `
              : "移动支付"}
            待确认。处理完成前不能继续收款。
          </div>
        ) : paymentOption !== "cash" ? (
          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
            客户需先在外部应用完成转账。这里只记录付款凭证，不会自动扣款；Owner 或 Manager
            核对商户账户后才能确认到账。
          </div>
        ) : null}

        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto]">
          <input
            className="h-11 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-300"
            disabled={!canPay || isPending}
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            value={amount}
          />
          {paymentOption !== "cash" ? (
            <input
              className="h-11 min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300"
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
            className={`flex h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              paymentOption === "cash"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-amber-600 hover:bg-amber-700"
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
          <div className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500">
            当前状态无可用流转。
          </div>
        ) : (
          transitions.map((status) => (
            <button
              className="flex h-11 items-center justify-between rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isPending}
              key={status}
              onClick={() => changeStatus(status)}
              type="button"
            >
              <span>设为 {ORDER_STATUS_LABELS[status]}</span>
              <Icon className="h-4 w-4 text-slate-400" name="chevron-right" />
            </button>
          ))
        )}

        <button
          className="mt-2 flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-4 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canDelete || isPending}
          onClick={remove}
          type="button"
        >
          <Icon className="h-4 w-4" name="trash" />
          删除订单
        </button>
      </div>
    </section>
  );
}

function getOutstandingAmount(order: PosOrderDetail): string {
  return Math.max(0, Number(order.totalAmount) - Number(order.paidAmount)).toFixed(2);
}

function createPaymentIdempotencyKey(orderId: string): string {
  const operationId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `pos-manual-payment:${orderId}:${operationId}`;
}
