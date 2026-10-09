"use client";

import { useState, useTransition } from "react";
import { posToast as toast } from "@/lib/pos-toast";
import { useTranslation } from "@cleanhub/i18n/react";
import { useRouter } from "next/navigation";
import type { PosOrderDetail } from "@cleanhub/api-client";
import {
  calendarDateEndToUtc,
  getDateOnlyInTimeZone,
} from "@cleanhub/domain/timezone";
import {
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Textarea,
} from "@cleanhub/ui";

import { Icon } from "@/components/app-shell";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { getActionErrorMessage } from "@/lib/action-error-message";

import { updateOrderAction } from "../actions";
import { formatOrderDateTime, formatOrderMoney } from "../constants";

export function OrderInfoEditor({ order }: { order: PosOrderDetail }) {
  const { locale } = useTranslation();
  const { timeZone } = usePosRuntimeConfig();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [expireAt, setExpireAt] = useState(
    toDateInput(order.expireAt, timeZone),
  );
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
        expireAt: toIsoOrNull(expireAt, timeZone),
        notes: notes.trim() || null,
        version: order.version,
      });

      if (result.ok) {
        toast.success("订单信息已保存。");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(getActionErrorMessage(result, "order"));
      }
    });
  }

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeader className="border-b px-5 py-4">
        <div>
          <CardTitle>订单信息</CardTitle>
          <CardDescription className="mt-1 text-xs">
            金额、时间与订单备注
          </CardDescription>
        </div>
        <CardAction>
          <Button
            disabled={!canEdit || isPending}
            onClick={() => setEditing((current) => !current)}
            size="sm"
            title={canEdit ? "编辑订单信息" : "当前订单不可编辑"}
            type="button"
            variant="outline"
          >
            <Icon className="h-3.5 w-3.5" name={editing ? "x" : "square-pen"} />
            {editing ? "取消" : "编辑"}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
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
          value={formatOrderDateTime(order.createdAt, locale, timeZone)}
        />
        <SummaryItem
          label="过期时间"
          value={formatOrderDateTime(order.expireAt, locale, timeZone)}
        />
        {order.settlementIntent !== "pay_now" ? (
          <>
            <SummaryItem
              label="未收余额"
              value={formatOrderMoney(
                Math.max(
                  0,
                  Number(order.totalAmount) - Number(order.paidAmount),
                ).toFixed(2),
                order.currency,
              )}
            />
            <SummaryItem
              label="最晚付款时间"
              value={formatOrderDateTime(order.balanceDueAt, locale, timeZone)}
            />
            <SummaryItem
              label="结算方式"
              value={
                order.settlementIntent === "partial" ? "部分付款" : "稍后付款"
              }
            />
            <SummaryItem label="欠款原因" value={order.unpaidReason ?? "-"} />
          </>
        ) : null}
      </CardContent>

      {editing ? (
        <CardContent className="grid gap-4 border-t px-5 py-5">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              过期日期
            </span>
            <Input
              onChange={(event) => setExpireAt(event.target.value)}
              type="date"
              value={expireAt}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
              备注
            </span>
            <Textarea
              className="min-h-24"
              onChange={(event) => setNotes(event.target.value)}
              value={notes}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              disabled={isPending}
              onClick={() => setEditing(false)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button disabled={isPending} onClick={save} type="button">
              {isPending ? "保存中..." : "保存"}
            </Button>
          </div>
        </CardContent>
      ) : order.notes ? (
        <CardContent className="border-t px-5 py-4">
          <div className="rounded-lg bg-muted/40 p-3 text-sm leading-6 text-foreground">
            {order.notes}
          </div>
        </CardContent>
      ) : null}
    </Card>
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

function toDateInput(iso: string | null, timeZone: string): string {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return getDateOnlyInTimeZone(date, timeZone);
}

function toIsoOrNull(value: string, timeZone: string): string | null {
  if (!value) {
    return null;
  }
  return calendarDateEndToUtc(value, timeZone).toISOString();
}
