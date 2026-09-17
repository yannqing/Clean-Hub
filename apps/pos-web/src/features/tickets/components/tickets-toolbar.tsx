"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
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
import { getTicketColumnLabel } from "@/lib/ticket-labels";

import {
  getTicketPriorityOptions,
  getTicketStatusOptions,
  getTicketTypeOptions,
} from "../constants";
import type { TicketListScope } from "../types";
import {
  TICKET_COLUMN_KEYS,
  TICKET_FILTER_KEYS,
  type TicketColumnKey,
} from "./ticket-filter-params";

const SCOPE_OPTIONS: ReadonlyArray<{ value: TicketListScope; label: string }> =
  [
    { value: "mine", label: "我的工单" },
    { value: "all", label: "全部工单" },
  ];

type TicketsToolbarProps = {
  mineCount: number;
  allCount: number;
};

export function TicketsToolbar({ allCount, mineCount }: TicketsToolbarProps) {
  const { locale } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState(params.get(TICKET_FILTER_KEYS.q) ?? "");

  const scope: TicketListScope =
    params.get(TICKET_FILTER_KEYS.scope) === "all" ? "all" : "mine";
  const status = params.get(TICKET_FILTER_KEYS.status) ?? "";
  const type = params.get(TICKET_FILTER_KEYS.type) ?? "";
  const priority = params.get(TICKET_FILTER_KEYS.priority) ?? "";
  const visibleColumns = parseVisibleColumns(
    params.get(TICKET_FILTER_KEYS.columns),
  );
  const visibleColumnCount = TICKET_COLUMN_KEYS.filter((column) =>
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
        count: option.value === "mine" ? mineCount : allCount,
      })),
    [allCount, locale, mineCount],
  );

  function setColumnVisible(column: TicketColumnKey, checked: boolean) {
    if (!checked && visibleColumnCount === 1 && visibleColumns.has(column)) {
      return;
    }

    const next = new Set(visibleColumns);
    if (checked) {
      next.add(column);
    } else {
      next.delete(column);
    }
    const isDefault = TICKET_COLUMN_KEYS.every((key) => next.has(key));
    apply(
      {
        [TICKET_FILTER_KEYS.columns]: isDefault
          ? undefined
          : TICKET_COLUMN_KEYS.filter((key) => next.has(key)).join(","),
      },
      false,
    );
  }

  return (
    <section className="min-w-0 border-y bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div
            aria-label={text("工单范围")}
            className="flex rounded-md bg-muted p-0.5"
            role="group"
          >
            {scopeOptions.map((option) => (
              <button
                aria-pressed={scope === option.value}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors",
                  scope === option.value
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
                disabled={isPending}
                key={option.value}
                onClick={() =>
                  apply({
                    [TICKET_FILTER_KEYS.scope]:
                      option.value === "mine" ? undefined : option.value,
                  })
                }
                type="button"
              >
                {option.label}
                <span className="text-[10px] text-muted-foreground">
                  {option.count}
                </span>
              </button>
            ))}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label={text("按状态筛选")}
                className={cn((status || type || priority) && "bg-accent")}
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
                label={text("工单状态")}
                onChange={(value) =>
                  apply({
                    [TICKET_FILTER_KEYS.status]: value || undefined,
                  })
                }
                options={[
                  { value: "", label: text("全部") },
                  ...getTicketStatusOptions().map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                ]}
                value={status}
              />
              <FilterGroup
                className="mt-3 border-t pt-3"
                label={text("工单类型")}
                onChange={(value) =>
                  apply({
                    [TICKET_FILTER_KEYS.type]: value || undefined,
                  })
                }
                options={[
                  { value: "", label: text("全部") },
                  ...getTicketTypeOptions().map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                ]}
                value={type}
              />
              <FilterGroup
                className="mt-3 border-t pt-3"
                label={text("优先级")}
                onChange={(value) =>
                  apply({
                    [TICKET_FILTER_KEYS.priority]: value || undefined,
                  })
                }
                options={[
                  { value: "", label: text("全部") },
                  ...getTicketPriorityOptions().map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                ]}
                value={priority}
              />
            </PopoverContent>
          </Popover>

          <div className="relative min-w-48 flex-1 sm:max-w-sm">
            <label className="sr-only" htmlFor="pos-ticket-search">
              {text("搜索工单")}
            </label>
            <Icon
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              name="search"
            />
            <Input
              className="h-8 pl-8 text-xs"
              id="pos-ticket-search"
              inputMode="search"
              onBlur={(event) => {
                const value = event.target.value.trim();
                if (value !== (params.get(TICKET_FILTER_KEYS.q) ?? "")) {
                  apply({ [TICKET_FILTER_KEYS.q]: value || undefined });
                }
              }}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  apply({
                    [TICKET_FILTER_KEYS.q]: draft.trim() || undefined,
                  });
                }
              }}
              placeholder={text("搜索工单号、客户名")}
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
            <div>
              <p className="px-1 text-xs font-semibold">{text("排序方式")}</p>
              <div className="mt-2 flex h-8 items-center gap-2 rounded-md bg-accent px-2 text-xs">
                <span aria-hidden className="w-3 text-center">
                  ✓
                </span>
                {text("默认：最新创建")}
              </div>
            </div>

            <div className="mt-3 border-t pt-3">
              <p className="px-1 text-xs font-semibold">{text("显示列")}</p>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                {TICKET_COLUMN_KEYS.map((column) => {
                  const checked = visibleColumns.has(column);
                  return (
                    <label
                      className="flex min-w-0 cursor-pointer items-center gap-2 text-xs"
                      htmlFor={`pos-ticket-column-${column}`}
                      key={column}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={checked && visibleColumnCount === 1}
                        id={`pos-ticket-column-${column}`}
                        onCheckedChange={(nextChecked) =>
                          setColumnVisible(column, nextChecked === true)
                        }
                      />
                      <span className="truncate">
                        {getTicketColumnLabel(column)}
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

function parseVisibleColumns(value: string | null): Set<TicketColumnKey> {
  if (!value) {
    return new Set(TICKET_COLUMN_KEYS);
  }

  const requested = new Set(value.split(","));
  const visible = TICKET_COLUMN_KEYS.filter((column) => requested.has(column));
  return new Set(visible.length > 0 ? visible : TICKET_COLUMN_KEYS);
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
