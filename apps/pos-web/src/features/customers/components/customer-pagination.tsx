"use client";

import type { ReactNode } from "react";
import { cn } from "@cleanhub/ui";

import { buildPaginationWindow } from "@/lib/pagination";

type CustomerPaginationProps = {
  total: number;
  pageSize: number;
  page: number;
  onPageChange: (page: number) => void;
};

export function CustomerPagination({
  total,
  pageSize,
  page,
  onPageChange,
}: CustomerPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pages = buildPaginationWindow(currentPage, pageCount);
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, total);

  return (
    <div className="flex flex-col gap-2 border-t px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">
        第 {from}–{to} 条 / 共 {total} 条
      </span>

      <div className="flex items-center gap-1">
        <PagerButton
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          上一页
        </PagerButton>
        {pages.map((entry, index) =>
          entry === "..." ? (
            <span className="px-1.5 text-muted-foreground" key={`gap-${index}`}>
              …
            </span>
          ) : (
            <PagerButton
              active={entry === currentPage}
              key={entry}
              onClick={() => onPageChange(entry)}
            >
              {entry}
            </PagerButton>
          ),
        )}
        <PagerButton
          disabled={currentPage >= pageCount}
          onClick={() => onPageChange(currentPage + 1)}
        >
          下一页
        </PagerButton>
      </div>
    </div>
  );
}

function PagerButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={cn(
        "flex h-10 min-w-10 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40 sm:h-7 sm:min-w-7",
        active
          ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-background text-foreground",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
