"use client";

import { buildPaginationWindow } from "@/lib/pagination";

import { CUSTOMER_PAGE_SIZE_OPTIONS } from "../constants";

type CustomerPaginationProps = {
  total: number;
  pageSize: number;
  page: number;
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
};

/**
 * Pagination footer: page-size select + prev/next + page numbers.
 */
export function CustomerPagination({
  total,
  pageSize,
  page,
  onPageSizeChange,
  onPageChange,
}: CustomerPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pages = buildPaginationWindow(page, pageCount);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-end gap-1">
        <select
          className="mr-2 h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm"
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          value={pageSize}
        >
          {CUSTOMER_PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              每页 {size} 条
            </option>
          ))}
        </select>
        <button
          className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold disabled:opacity-40"
          disabled={page === 1}
          type="button"
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </button>
        {pages.map((entry, index) =>
          entry === "..." ? (
            <span className="px-1.5 text-slate-400" key={`gap-${index}`}>
              …
            </span>
          ) : (
            <button
              className={`h-11 min-w-11 rounded-lg text-sm font-semibold ${
                entry === page
                  ? "bg-slate-950 text-white"
                  : "border border-slate-200 text-slate-600"
              }`}
              key={entry}
              type="button"
              onClick={() => onPageChange(entry)}
            >
              {entry}
            </button>
          ),
        )}
        <button
          className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold disabled:opacity-40"
          disabled={page === pageCount}
          type="button"
          onClick={() => onPageChange(page + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
