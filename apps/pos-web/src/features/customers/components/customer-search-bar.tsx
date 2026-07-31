"use client";

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

import {
  CUSTOMER_COLUMN_KEYS,
  CUSTOMER_COLUMN_LABELS,
  CUSTOMER_RESULT_TYPE_OPTIONS,
  CUSTOMER_STATUS_OPTIONS,
  type CustomerColumnKey,
} from "../constants";
import type {
  CustomerFilterState,
  CustomerStatusFilter,
  ResultTypeFilter,
} from "../types";

type CustomerSearchBarProps = {
  filters: CustomerFilterState;
  accountContext: boolean;
  draftQuery: string;
  visibleColumns: ReadonlySet<CustomerColumnKey>;
  onColumnVisibleChange: (column: CustomerColumnKey, checked: boolean) => void;
  onDraftQueryChange: (value: string) => void;
  onResultTypeChange: (value: ResultTypeFilter) => void;
  onStatusChange: (value: CustomerStatusFilter) => void;
  onSearch: () => void;
  onReset: () => void;
};

export function CustomerSearchBar({
  filters,
  accountContext,
  draftQuery,
  visibleColumns,
  onColumnVisibleChange,
  onDraftQueryChange,
  onResultTypeChange,
  onStatusChange,
  onSearch,
  onReset,
}: CustomerSearchBarProps) {
  const visibleColumnCount = CUSTOMER_COLUMN_KEYS.filter((column) =>
    visibleColumns.has(column),
  ).length;
  const hasActiveFilters =
    filters.resultType !== "all" || filters.status !== "all";

  return (
    <div className="flex items-center gap-2 border-b px-3 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {!accountContext ? (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label="按状态筛选"
                className={cn(hasActiveFilters && "bg-accent")}
                size="icon-sm"
                title="按状态筛选"
                type="button"
                variant="outline"
              >
                <ListFilterGlyph />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3">
              <FilterGroup
                label="客户状态"
                onChange={(value) =>
                  onStatusChange(value as CustomerStatusFilter)
                }
                options={CUSTOMER_STATUS_OPTIONS}
                value={filters.status}
              />
              <FilterGroup
                className="mt-3 border-t pt-3"
                label="结果类型"
                onChange={(value) =>
                  onResultTypeChange(value as ResultTypeFilter)
                }
                options={CUSTOMER_RESULT_TYPE_OPTIONS}
                value={filters.resultType}
              />
              {hasActiveFilters ? (
                <button
                  className="mt-3 h-8 w-full rounded-md border text-xs font-medium transition-colors hover:bg-accent"
                  onClick={onReset}
                  type="button"
                >
                  重置筛选
                </button>
              ) : null}
            </PopoverContent>
          </Popover>
        ) : null}

        <div className="relative w-full max-w-sm">
          <label className="sr-only" htmlFor="pos-customer-search">
            搜索客户
          </label>
          <Icon
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            name="search"
          />
          <Input
            className="h-8 pl-8 text-xs"
            id="pos-customer-search"
            inputMode="search"
            onBlur={onSearch}
            onChange={(event) => onDraftQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearch();
              }
            }}
            placeholder={
              accountContext
                ? "搜索当前账户下的客户档案"
                : "搜索姓名、手机号或邮箱"
            }
            type="search"
            value={draftQuery}
          />
        </div>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            aria-label="排序与显示列"
            size="icon-sm"
            title="排序与显示列"
            type="button"
            variant="outline"
          >
            <Icon className="size-[15px]" name="settings" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <div>
            <p className="px-1 text-xs font-semibold">排序方式</p>
            <div className="mt-2 flex h-8 items-center gap-2 rounded-md bg-accent px-2 text-xs">
              <span aria-hidden className="w-3 text-center">
                ✓
              </span>
              默认：最新创建
            </div>
          </div>

          <div className="mt-3 border-t pt-3">
            <p className="px-1 text-xs font-semibold">显示列</p>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
              {CUSTOMER_COLUMN_KEYS.map((column) => {
                const checked = visibleColumns.has(column);
                return (
                  <label
                    className="flex min-w-0 cursor-pointer items-center gap-2 text-xs"
                    htmlFor={`pos-customer-column-${column}`}
                    key={column}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={checked && visibleColumnCount === 1}
                      id={`pos-customer-column-${column}`}
                      onCheckedChange={(nextChecked) =>
                        onColumnVisibleChange(column, nextChecked === true)
                      }
                    />
                    <span className="truncate">
                      {CUSTOMER_COLUMN_LABELS[column]}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
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
            key={option.value}
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
