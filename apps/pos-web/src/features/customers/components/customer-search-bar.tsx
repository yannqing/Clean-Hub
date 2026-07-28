"use client";

import { CUSTOMER_RESULT_TYPE_OPTIONS } from "../constants";
import type { CustomerFilterState, ResultTypeFilter } from "../types";
import { Icon } from "@/components/app-shell";

type CustomerSearchBarProps = {
  filters: CustomerFilterState;
  accountContext: boolean;
  draftQuery: string;
  onDraftQueryChange: (value: string) => void;
  onResultTypeChange: (value: ResultTypeFilter) => void;
  onSearch: () => void;
  onReset: () => void;
};

/**
 * Search bar: keyword input + result-type dropdown (hidden in account view) +
 * reset + search buttons.
 */
export function CustomerSearchBar({
  filters,
  accountContext,
  draftQuery,
  onDraftQueryChange,
  onResultTypeChange,
  onSearch,
  onReset,
}: CustomerSearchBarProps) {
  return (
    <div className="border-b border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-10 min-w-[320px] flex-1 items-center rounded-lg border border-slate-200 bg-white px-3">
          <Icon className="mr-2 h-4 w-4 text-slate-400" name="search" />
          <input
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
            onChange={(event) => onDraftQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSearch();
              }
            }}
            placeholder={
              accountContext
                ? "查询当前账户下的档案姓名、手机号或邮箱"
                : "查询手机号、邮箱、账户名称或档案姓名"
            }
            value={draftQuery}
          />
        </div>

        {!accountContext ? (
          <select
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
            onChange={(event) =>
              onResultTypeChange(event.target.value as ResultTypeFilter)
            }
            value={filters.resultType}
          >
            {CUSTOMER_RESULT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : null}

        <button
          className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600"
          type="button"
          onClick={onReset}
        >
          重置
        </button>
        <button
          className="h-10 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800"
          type="button"
          onClick={onSearch}
        >
          查询
        </button>
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {accountContext
          ? "当前仅查询该账户下的客户档案。"
          : "账户联系方式命中时，会同时展示该账户及其关联档案；档案联系方式命中时，直接展示对应档案。"}
      </div>
    </div>
  );
}
