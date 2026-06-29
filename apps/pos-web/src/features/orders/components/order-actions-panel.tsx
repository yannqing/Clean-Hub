"use client";

import { toast } from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { PosOrderDetail, PosOrderStatus } from "@cleanhub/api-client";

import { Icon } from "@/components/app-shell";

import {
  changeOrderStatusAction,
  deleteOrderAction,
  payOrderAction,
} from "../actions";
import {
  formatOrderMoney,
  ORDER_STATUS_LABELS,
} from "../constants";

const STATUS_TRANSITIONS: Record<PosOrderStatus, PosOrderStatus[]> = {
  draft: ["received", "cancelled"],
  received: ["cancelled"],
  paid: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function OrderActionsPanel({ order }: { order: PosOrderDetail }) {
  const router = useRouter();
  const [amount, setAmount] = useState(getOutstandingAmount(order));
  const [isPending, startTransition] = useTransition();

  const outstanding = getOutstandingAmount(order);
  const canPay =
    Number(outstanding) > 0 &&
    order.status !== "cancelled" &&
    order.status !== "delivered";
  const transitions = STATUS_TRANSITIONS[order.status];
  const canDelete =
    Number(order.paidAmount) === 0 &&
    ["draft", "received", "cancelled"].includes(order.status);

  function pay() {
    startTransition(async () => {
      const result = await payOrderAction(order.id, {
        paymentMethod: "cash",
        amount,
      });
      if (result.ok) {
        toast.success("现金收款已记录。");
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
          {formatOrderMoney(outstanding)}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-300"
            disabled={!canPay || isPending}
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            value={amount}
          />
          <button
            className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canPay || isPending || Number(amount) <= 0}
            onClick={pay}
            type="button"
          >
            <Icon className="h-4 w-4" name="wallet-cards" />
            现金收款
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
              className="flex h-10 items-center justify-between rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="mt-2 flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
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
