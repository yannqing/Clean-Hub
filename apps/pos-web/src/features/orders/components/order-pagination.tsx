"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { useTranslation } from "@cleanhub/i18n/react";

import { translatePosText } from "@/components/i18n/pos-runtime-text";

import { DEFAULT_ORDER_PAGE_SIZE, ORDER_FILTER_KEYS } from "../constants";

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function OrderPagination({ total }: { total: number }) {
  const { locale } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const pageSize = parsePositiveInt(
    params.get(ORDER_FILTER_KEYS.pageSize),
    DEFAULT_ORDER_PAGE_SIZE,
  );
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(
    parsePositiveInt(params.get(ORDER_FILTER_KEYS.page), 1),
    pageCount,
  );

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const text = (value: string) => translatePosText(value, locale);

  function replace(search: URLSearchParams) {
    startTransition(() => {
      router.replace(`/orders?${search.toString()}`, { scroll: false });
    });
  }

  function goTo(nextPage: number) {
    const clamped = Math.min(Math.max(1, nextPage), pageCount);
    if (clamped === page) {
      return;
    }
    const search = new URLSearchParams(params.toString());
    search.set(ORDER_FILTER_KEYS.page, String(clamped));
    replace(search);
  }

  function changeSize(nextSize: number) {
    const search = new URLSearchParams(params.toString());
    search.set(ORDER_FILTER_KEYS.pageSize, String(nextSize));
    search.set(ORDER_FILTER_KEYS.page, "1");
    replace(search);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm">
      <div className="flex items-center gap-3">
        <span className="text-slate-500">
          {formatOrderRange(from, to, total, locale)}
        </span>
        <label className="flex items-center gap-2 text-slate-500">
          {text("每页")}
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 outline-none disabled:opacity-60"
            disabled={isPending}
            onChange={(event) => changeSize(Number(event.target.value))}
            value={pageSize}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          {text("条")}
        </label>
      </div>

      <div className="flex items-center gap-1">
        <PagerButton
          disabled={isPending || page <= 1}
          onClick={() => goTo(page - 1)}
        >
          {text("上一页")}
        </PagerButton>
        <span className="px-2 text-sm font-semibold text-slate-600">
          {page} / {pageCount}
        </span>
        <PagerButton
          disabled={isPending || page >= pageCount}
          onClick={() => goTo(page + 1)}
        >
          {text("下一页")}
        </PagerButton>
      </div>
    </div>
  );
}

function formatOrderRange(
  from: number,
  to: number,
  total: number,
  locale: string,
): string {
  if (locale === "en") {
    return `${from}–${to} of ${total}`;
  }
  if (locale === "fr") {
    return `${from}–${to} sur ${total}`;
  }
  return `第 ${from}–${to} 条 / 共 ${total} 条`;
}

function PagerButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className="flex h-11 min-w-11 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
