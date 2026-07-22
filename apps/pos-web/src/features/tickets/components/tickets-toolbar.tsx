"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { useTranslation } from "@cleanhub/i18n/react";

import { Icon } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";

import {
  TICKET_PRIORITY_OPTIONS,
  TICKET_STATUS_OPTIONS,
  TICKET_TYPE_OPTIONS,
} from "../constants";
import { TICKET_FILTER_KEYS } from "./ticket-filter-params";
import type { TicketListDateFilter, TicketListScope } from "../types";

const DATE_OPTIONS: ReadonlyArray<{ value: TicketListDateFilter; label: string }> = [
  { value: "all", label: "全部日期" },
  { value: "pickup_today", label: "今日取件" },
  { value: "overdue", label: "已逾期" },
  { value: "last_7d", label: "近 7 天" },
];

const SCOPE_OPTIONS: ReadonlyArray<{ value: TicketListScope; label: string }> = [
  { value: "mine", label: "我的工单" },
  { value: "all", label: "全部工单" },
];

type TicketsToolbarProps = {
  /** Total visible under the currently selected scope and filters. */
  currentCount: number;
  /** Count under the "mine" scope using the same filters, ignoring pagination. */
  mineCount: number;
  /** Count under the "all" scope using the same filters, ignoring pagination. */
  allCount: number;
};

/**
 * Toolbar with scope toggle + filters. Mutations push to the URL so the server
 * component re-fetches; we never keep filter state locally beyond the input.
 * This keeps filters shareable/deep-linkable and avoids RSC/client drift.
 */
export function TicketsToolbar({
  allCount,
  currentCount,
  mineCount,
}: TicketsToolbarProps) {
  const { locale } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(params.get(TICKET_FILTER_KEYS.q) ?? "");

  const scope: TicketListScope =
    (params.get(TICKET_FILTER_KEYS.scope) as TicketListScope) === "all"
      ? "all"
      : "mine";
  const status = params.get(TICKET_FILTER_KEYS.status) ?? "";
  const type = params.get(TICKET_FILTER_KEYS.type) ?? "";
  const priority = params.get(TICKET_FILTER_KEYS.priority) ?? "";
  const date = (params.get(TICKET_FILTER_KEYS.date) as TicketListDateFilter) ?? "all";

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
      // Any filter/scope change invalidates the current page offset, so drop
      // back to page 1 unless the caller explicitly opts out.
      if (resetPage) {
        search.delete(TICKET_FILTER_KEYS.page);
      }
      startTransition(() => {
        router.replace(`/tickets?${search.toString()}`, { scroll: false });
      });
    },
    [params, router],
  );

  const scopeOptions = useMemo(
    () =>
      SCOPE_OPTIONS.map((option) => ({
        ...option,
        label: translatePosText(option.label, locale),
        // Only show a count badge when we have one for that scope.
        count: option.value === "mine" ? mineCount : allCount,
        active: scope === option.value,
      })),
    [allCount, locale, mineCount, scope],
  );

  const text = (value: string) => translatePosText(value, locale);

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          aria-label={text("工单范围")}
          className="flex rounded-lg bg-slate-100 p-1"
          role="group"
        >
          {scopeOptions.map((option) => (
            <button
              aria-pressed={option.active}
              className={`flex h-8 items-center gap-2 rounded-md px-3 text-sm font-semibold transition ${
                option.active
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              disabled={isPending}
              key={option.value}
              onClick={() => apply({ [TICKET_FILTER_KEYS.scope]: option.value })}
              type="button"
            >
              {option.label}
              {option.count !== null ? (
                <span
                  className={`rounded bg-slate-100 px-1.5 py-0.5 text-[11px] ${
                    option.active ? "text-blue-600" : "text-slate-400"
                  }`}
                >
                  {option.count}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500">
          {text("当前范围 · 共")} {currentCount} {text("条")}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <div className="flex h-10 min-w-[250px] flex-1 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-300 focus-within:bg-white">
          <Icon className="mr-2 h-4 w-4 text-slate-400" name="search" />
          <input
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value !== (params.get(TICKET_FILTER_KEYS.q) ?? "")) {
                apply({ [TICKET_FILTER_KEYS.q]: value || undefined });
              }
            }}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                apply({ [TICKET_FILTER_KEYS.q]: draft.trim() || undefined });
              }
            }}
            placeholder={text("工单号、客户名")}
            value={draft}
          />
        </div>

        <FilterSelect
          label={text("状态")}
          onChange={(value) =>
            apply({ [TICKET_FILTER_KEYS.status]: value || undefined })
          }
          options={TICKET_STATUS_OPTIONS.map((option) => ({
            value: option.value,
            label: text(option.label),
          }))}
          placeholder={text("全部状态")}
          value={status}
        />
        <FilterSelect
          label={text("类型")}
          onChange={(value) =>
            apply({ [TICKET_FILTER_KEYS.type]: value || undefined })
          }
          options={TICKET_TYPE_OPTIONS.map((option) => ({
            value: option.value,
            label: text(option.label),
          }))}
          placeholder={text("全部类型")}
          value={type}
        />
        <FilterSelect
          label={text("优先级")}
          onChange={(value) =>
            apply({ [TICKET_FILTER_KEYS.priority]: value || undefined })
          }
          options={TICKET_PRIORITY_OPTIONS.map((option) => ({
            value: option.value,
            label: text(option.label),
          }))}
          placeholder={text("全部优先级")}
          value={priority}
        />
        <FilterSelect
          label={text("日期")}
          onChange={(value) =>
            apply({
              [TICKET_FILTER_KEYS.date]:
                value === "all" ? undefined : (value as TicketListDateFilter),
            })
          }
          options={DATE_OPTIONS.map((option) => ({
            value: option.value,
            label: text(option.label),
          }))}
          placeholder={text("全部日期")}
          value={date}
        />

        <button
          className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          disabled={isPending}
          onClick={() => router.replace("/tickets", { scroll: false })}
          type="button"
        >
          <Icon className="h-4 w-4" name="rotate-ccw" />
          {text("重置")}
        </button>
      </div>
    </section>
  );
}

type FilterSelectProps = {
  label: string;
  value: string;
  placeholder: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
};

/** Native select keeps the toolbar light and keyboard-friendly. */
function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: FilterSelectProps) {
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
