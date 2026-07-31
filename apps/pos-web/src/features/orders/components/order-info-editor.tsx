"use client";

import { useState, useTransition } from "react";
import { posToast as toast } from "@/lib/pos-toast";
import { useTranslation } from "@cleanhub/i18n/react";
import { useRouter } from "next/navigation";
import type { PosOrderDetail } from "@cleanhub/api-client";

import { Icon } from "@/components/app-shell";

import { updateOrderAction } from "../actions";
import { formatOrderDateTime, formatOrderMoney } from "../constants";

export function OrderInfoEditor({ order }: { order: PosOrderDetail }) {
  const { locale } = useTranslation();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [expireAt, setExpireAt] = useState(toDateInput(order.expireAt));
  const [notes, setNotes] = useState(order.notes ?? "");
  const [isPending, startTransition] = useTransition();
  const canEdit =
    Number(order.paidAmount) === 0 &&
    order.status !== "paid" &&
    order.status !== "delivered" &&
    order.status !== "cancelled";

  function save() {
    startTransition(async () => {
      const result = await updateOrderAction(order.id, {
        expireAt: toIsoOrNull(expireAt),
        notes: notes.trim() || null,
        version: order.version,
      });

      if (result.ok) {
        toast.success("订单信息已保存。");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <section className="border-y bg-background p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold text-foreground">订单信息</h2>
        <button
          className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canEdit || isPending}
          onClick={() => setEditing((current) => !current)}
          title={canEdit ? "编辑订单信息" : "当前订单不可编辑"}
          type="button"
        >
          <Icon className="h-3.5 w-3.5" name={editing ? "x" : "square-pen"} />
          {editing ? "取消" : "编辑"}
        </button>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem
          label="订单金额"
          value={formatOrderMoney(order.totalAmount, order.currency)}
        />
        <SummaryItem
          label="已收金额"
          value={formatOrderMoney(order.paidAmount, order.currency)}
        />
        <SummaryItem
          label="创建时间"
          value={formatOrderDateTime(order.createdAt, locale)}
        />
        <SummaryItem
          label="过期时间"
          value={formatOrderDateTime(order.expireAt, locale)}
        />
      </div>

      {editing ? (
        <div className="mt-4 grid gap-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              过期日期
            </span>
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => setExpireAt(event.target.value)}
              type="date"
              value={expireAt}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              备注
            </span>
            <textarea
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              className="h-9 rounded-md border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
              disabled={isPending}
              onClick={() => setEditing(false)}
              type="button"
            >
              取消
            </button>
            <button
              className="h-9 rounded-md bg-foreground px-4 text-sm font-semibold text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
              disabled={isPending}
              onClick={save}
              type="button"
            >
              {isPending ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      ) : order.notes ? (
        <div className="mt-4 rounded-md bg-muted/40 p-3 text-sm text-foreground">
          {order.notes}
        </div>
      ) : null}
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function toDateInput(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function toIsoOrNull(value: string): string | null {
  if (!value) {
    return null;
  }
  return new Date(`${value}T23:59:59`).toISOString();
}
