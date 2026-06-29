"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Icon } from "@/components/app-shell";

import {
  ORDER_FILTER_KEYS,
  ORDER_PAYMENT_STATUS_OPTIONS,
  ORDER_STATUS_OPTIONS,
  ORDER_TYPE_OPTIONS,
  type OrderDateFilter,
} from "../constants";

const DATE_OPTIONS: ReadonlyArray<{
  value: Exclude<OrderDateFilter, "all">;
  label: string;
}> = [
  { value: "today", label: "今天" },
  { value: "last_7d", label: "近 7 天" },
  { value: "month", label: "本月" },
];

export function OrdersToolbar({ totalCount }: { totalCount: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(params.get(ORDER_FILTER_KEYS.q) ?? "");

  const status = params.get(ORDER_FILTER_KEYS.status) ?? "";
  const paymentStatus = params.get(ORDER_FILTER_KEYS.paymentStatus) ?? "";
  const orderType = params.get(ORDER_FILTER_KEYS.orderType) ?? "";
  const date = params.get(ORDER_FILTER_KEYS.date) ?? "";

  const apply = useCallback(
    (next: Record<string, string | undefined>, resetPage = true) => {
      const search = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(next)) {
        if (!value) {
          search.delete(key);
        } else {
          search.set(key, value);
        }
      }
      if (resetPage) {
        search.delete(ORDER_FILTER_KEYS.page);
      }
      startTransition(() => {
        router.replace(`/orders?${search.toString()}`, { scroll: false });
      });
    },
    [params, router],
  );

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Icon className="h-4 w-4 text-blue-600" name="receipt" />
          订单筛选
        </div>
        <div className="text-xs text-slate-500">当前结果 · 共 {totalCount} 条</div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <div className="flex h-10 min-w-[250px] flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-300 focus-within:bg-white">
          <Icon className="mr-2 h-4 w-4 text-slate-400" name="search" />
          <input
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value !== (params.get(ORDER_FILTER_KEYS.q) ?? "")) {
                apply({ [ORDER_FILTER_KEYS.q]: value || undefined });
              }
            }}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                apply({ [ORDER_FILTER_KEYS.q]: draft.trim() || undefined });
              }
            }}
            placeholder="订单号、客户名"
            value={draft}
          />
        </div>

        <FilterSelect
          label="状态"
          onChange={(value) =>
            apply({ [ORDER_FILTER_KEYS.status]: value || undefined })
          }
          options={ORDER_STATUS_OPTIONS}
          placeholder="全部状态"
          value={status}
        />
        <FilterSelect
          label="支付"
          onChange={(value) =>
            apply({ [ORDER_FILTER_KEYS.paymentStatus]: value || undefined })
          }
          options={ORDER_PAYMENT_STATUS_OPTIONS}
          placeholder="全部支付"
          value={paymentStatus}
        />
        <FilterSelect
          label="类型"
          onChange={(value) =>
            apply({ [ORDER_FILTER_KEYS.orderType]: value || undefined })
          }
          options={ORDER_TYPE_OPTIONS}
          placeholder="全部类型"
          value={orderType}
        />
        <FilterSelect
          label="日期"
          onChange={(value) =>
            apply({
              [ORDER_FILTER_KEYS.date]:
                value === "all" ? undefined : (value as OrderDateFilter),
            })
          }
          options={DATE_OPTIONS}
          placeholder="全部日期"
          value={date}
        />

        <button
          className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          disabled={isPending}
          onClick={() => router.replace("/orders", { scroll: false })}
          type="button"
        >
          <Icon className="h-4 w-4" name="rotate-ccw" />
          重置
        </button>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm">
      <span className="font-medium text-slate-500">{label}</span>
      <select
        className="bg-transparent text-sm text-slate-700 outline-none"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
