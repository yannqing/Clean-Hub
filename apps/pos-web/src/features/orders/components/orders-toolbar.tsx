"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { PosOrderSort } from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import {
  Button,
  Checkbox,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@cleanhub/ui";

import { Icon } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";

import {
  ORDER_COLUMN_KEYS,
  ORDER_COLUMN_LABELS,
  ORDER_FILTER_KEYS,
  ORDER_PAYMENT_STATUS_OPTIONS,
  ORDER_SORT_OPTIONS,
  ORDER_STATUS_OPTIONS,
  ORDER_TYPE_OPTIONS,
  type OrderColumnKey,
} from "../constants";

export function OrdersToolbar() {
  const { locale } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(params.get(ORDER_FILTER_KEYS.q) ?? "");

  const status = params.get(ORDER_FILTER_KEYS.status) ?? "";
  const paymentStatus = params.get(ORDER_FILTER_KEYS.paymentStatus) ?? "";
  const orderType = params.get(ORDER_FILTER_KEYS.orderType) ?? "";
  const sort =
    (params.get(ORDER_FILTER_KEYS.sort) as PosOrderSort | null) ??
    "created_desc";
  const visibleColumns = parseVisibleColumns(
    params.get(ORDER_FILTER_KEYS.columns),
  );
  const visibleColumnCount = ORDER_COLUMN_KEYS.filter((column) =>
    visibleColumns.has(column),
  ).length;
  const text = (value: string) => translatePosText(value, locale);

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

  function setColumnVisible(column: OrderColumnKey, checked: boolean) {
    if (!checked && visibleColumnCount === 1 && visibleColumns.has(column)) {
      return;
    }

    const next = new Set(visibleColumns);
    if (checked) {
      next.add(column);
    } else {
      next.delete(column);
    }
    const isDefault = ORDER_COLUMN_KEYS.every((key) => next.has(key));
    apply(
      {
        [ORDER_FILTER_KEYS.columns]: isDefault
          ? undefined
          : ORDER_COLUMN_KEYS.filter((key) => next.has(key)).join(","),
      },
      false,
    );
  }

  return (
    <section className="min-w-0 border-y bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label={text("按状态筛选")}
                className={cn(
                  (status || paymentStatus || orderType) && "bg-accent",
                )}
                disabled={isPending}
                size="icon-sm"
                title={text("按状态筛选")}
                type="button"
                variant="outline"
              >
                <ListFilterGlyph />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 p-3">
              <FilterGroup
                label={text("订单状态")}
                onChange={(value) =>
                  apply({
                    [ORDER_FILTER_KEYS.status]: value || undefined,
                  })
                }
                options={[
                  { value: "", label: text("全部") },
                  ...ORDER_STATUS_OPTIONS.map((option) => ({
                    value: option.value,
                    label: text(option.label),
                  })),
                ]}
                value={status}
              />
              <FilterGroup
                className="mt-3 border-t pt-3"
                label={text("支付状态")}
                onChange={(value) =>
                  apply({
                    [ORDER_FILTER_KEYS.paymentStatus]: value || undefined,
                  })
                }
                options={[
                  { value: "", label: text("全部") },
                  ...ORDER_PAYMENT_STATUS_OPTIONS.map((option) => ({
                    value: option.value,
                    label: text(option.label),
                  })),
                ]}
                value={paymentStatus}
              />
              <FilterGroup
                className="mt-3 border-t pt-3"
                label={text("订单类型")}
                onChange={(value) =>
                  apply({
                    [ORDER_FILTER_KEYS.orderType]: value || undefined,
                  })
                }
                options={[
                  { value: "", label: text("全部") },
                  ...ORDER_TYPE_OPTIONS.map((option) => ({
                    value: option.value,
                    label: text(option.label),
                  })),
                ]}
                value={orderType}
              />
            </PopoverContent>
          </Popover>

          <div className="relative w-full max-w-sm">
            <label className="sr-only" htmlFor="pos-order-search">
              {text("搜索订单")}
            </label>
            <Icon
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              name="search"
            />
            <Input
              className="h-8 pl-8 text-xs"
              id="pos-order-search"
              inputMode="search"
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value !== (params.get(ORDER_FILTER_KEYS.q) ?? "")) {
                  apply({ [ORDER_FILTER_KEYS.q]: value || undefined });
                }
              }}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  apply({
                    [ORDER_FILTER_KEYS.q]: draft.trim() || undefined,
                  });
                }
              }}
              placeholder={text("搜索订单号、客户名")}
              type="search"
              value={draft}
            />
          </div>
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              aria-label={text("排序与显示列")}
              disabled={isPending}
              size="icon-sm"
              title={text("排序与显示列")}
              type="button"
              variant="outline"
            >
              <Icon className="size-[15px]" name="settings" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-3">
            <FilterGroup
              label={text("排序方式")}
              onChange={(value) =>
                apply({
                  [ORDER_FILTER_KEYS.sort]: value || undefined,
                })
              }
              options={ORDER_SORT_OPTIONS.map((option) => ({
                value: option.value,
                label: text(option.label),
              }))}
              value={sort}
            />

            <div className="mt-3 border-t pt-3">
              <p className="px-1 text-xs font-semibold">{text("显示列")}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                {ORDER_COLUMN_KEYS.map((column) => {
                  const checked = visibleColumns.has(column);
                  return (
                    <label
                      className="flex min-w-0 cursor-pointer items-center gap-2 text-xs"
                      htmlFor={`pos-order-column-${column}`}
                      key={column}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={checked && visibleColumnCount === 1}
                        id={`pos-order-column-${column}`}
                        onCheckedChange={(nextChecked) =>
                          setColumnVisible(column, nextChecked === true)
                        }
                      />
                      <span className="truncate">
                        {text(ORDER_COLUMN_LABELS[column])}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </section>
  );
}

function FilterGroup({
  className,
  label,
  value,
  options,
  onChange,
}: {
  className?: string;
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className={className}>
      <p className="px-1 text-xs font-semibold">{label}</p>
      <div className="mt-2 grid gap-1">
        {options.map((option) => (
          <button
            aria-pressed={value === option.value}
            className={cn(
              "flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors hover:bg-accent",
              value === option.value && "bg-accent",
            )}
            key={option.value || "all"}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <span
              aria-hidden
              className={cn(
                "w-3 text-center",
                value === option.value ? "opacity-100" : "opacity-0",
              )}
            >
              ✓
            </span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function parseVisibleColumns(value: string | null): Set<OrderColumnKey> {
  if (!value) {
    return new Set(ORDER_COLUMN_KEYS);
  }

  const requested = new Set(value.split(","));
  const visible = ORDER_COLUMN_KEYS.filter((column) => requested.has(column));
  return new Set(visible.length > 0 ? visible : ORDER_COLUMN_KEYS);
}

function ListFilterGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-[15px]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18M7 12h10M10 18h4" />
    </svg>
  );
}
