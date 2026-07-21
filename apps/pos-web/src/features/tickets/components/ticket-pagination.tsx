"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { buildPaginationWindow } from "@/lib/pagination";

import {
  DEFAULT_TICKET_PAGE_SIZE,
  TICKET_FILTER_KEYS,
  TICKET_PAGE_SIZE_OPTIONS,
  parsePageParam,
  parsePageSizeParam,
} from "./ticket-filter-params";

type TicketPaginationProps = {
  total: number;
};

/**
 * Pagination bar for the tickets list. Page and page size live in the URL
 * (`page`, `pageSize`) so the server component re-fetches on change — the
 * controls here only push URL state, they never hold data.
 *
 * Computes a compact page-number window around the current page so very wide
 * result sets don't render dozens of buttons.
 */
export function TicketPagination({ total }: TicketPaginationProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const pageSize = parsePageSizeParam(params.get(TICKET_FILTER_KEYS.pageSize));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(
    parsePageParam(params.get(TICKET_FILTER_KEYS.page)),
    pageCount,
  );

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function goTo(nextPage: number) {
    const clamped = Math.min(Math.max(1, nextPage), pageCount);
    if (clamped === page) {
      return;
    }
    const search = new URLSearchParams(params.toString());
    search.set(TICKET_FILTER_KEYS.page, String(clamped));
    startTransition(() => {
      router.replace(`/tickets?${search.toString()}`, { scroll: false });
    });
  }

  function changeSize(nextSize: number) {
    const search = new URLSearchParams(params.toString());
    search.set(TICKET_FILTER_KEYS.pageSize, String(nextSize));
    // Reset to first page so the offset stays valid for the new size.
    search.set(TICKET_FILTER_KEYS.page, "1");
    startTransition(() => {
      router.replace(`/tickets?${search.toString()}`, { scroll: false });
    });
  }

  const pages = buildPaginationWindow(page, pageCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-slate-500">
          第 <span className="font-semibold text-slate-700">{from}</span>–
          <span className="font-semibold text-slate-700">{to}</span> 条 / 共{" "}
          <span className="font-semibold text-slate-700">{total}</span> 条
        </span>
        <label className="flex items-center gap-2 text-slate-500">
          每页
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none disabled:opacity-60"
            disabled={isPending}
            onChange={(event) => changeSize(Number(event.target.value))}
            value={pageSize}
          >
            {TICKET_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          条
        </label>
      </div>

      <div className="flex items-center gap-1">
        <PagerButton
          disabled={isPending || page <= 1}
          onClick={() => goTo(page - 1)}
        >
          上一页
        </PagerButton>
        {pages.map((entry, index) =>
          entry === "..." ? (
            <span className="px-2 text-slate-400" key={`gap-${index}`}>
              …
            </span>
          ) : (
            <PagerButton
              active={entry === page}
              disabled={isPending}
              key={entry}
              onClick={() => goTo(entry)}
            >
              {entry}
            </PagerButton>
          ),
        )}
        <PagerButton
          disabled={isPending || page >= pageCount}
          onClick={() => goTo(page + 1)}
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
  children: React.ReactNode;
}) {
  return (
    <button
      className={`flex h-11 min-w-11 items-center justify-center rounded-md px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "bg-blue-600 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

void DEFAULT_TICKET_PAGE_SIZE;
