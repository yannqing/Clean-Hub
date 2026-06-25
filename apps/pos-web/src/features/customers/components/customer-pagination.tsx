"use client";

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
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
      <div className="text-sm text-slate-500">
        正在显示第 {start}-{end} 条，共 {total} 条
      </div>
      <div className="flex items-center gap-1">
        <select
          className="mr-2 h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
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
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-40"
          disabled={page === 1}
          type="button"
          onClick={() => onPageChange(page - 1)}
        >
          上一页
        </button>
        {Array.from({ length: pageCount }, (_, index) => index + 1).map(
          (pageNumber) => (
            <button
              className={`h-9 min-w-9 rounded-lg text-sm font-semibold ${
                pageNumber === page
                  ? "bg-blue-600 text-white"
                  : "border border-slate-200 text-slate-600"
              }`}
              key={pageNumber}
              type="button"
              onClick={() => onPageChange(pageNumber)}
            >
              {pageNumber}
            </button>
          ),
        )}
        <button
          className="h-9 rounded-lg border border-slate-200 px-3 text-sm font-semibold disabled:opacity-40"
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
