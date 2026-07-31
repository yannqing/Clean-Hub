"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, type ReactNode } from "react";
import { useTranslation } from "@cleanhub/i18n/react";
import { cn } from "@cleanhub/ui";

import { translatePosText } from "@/components/i18n/pos-runtime-text";
import { buildPaginationWindow } from "@/lib/pagination";

import {
  DEFAULT_TICKET_PAGE_SIZE,
  TICKET_FILTER_KEYS,
  parsePageParam,
} from "./ticket-filter-params";

type TicketPaginationProps = {
  total: number;
};

export function TicketPagination({ total }: TicketPaginationProps) {
  const { locale } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const pageCount = Math.max(1, Math.ceil(total / DEFAULT_TICKET_PAGE_SIZE));
  const page = Math.min(
    parsePageParam(params.get(TICKET_FILTER_KEYS.page)),
    pageCount,
  );
  const from = total === 0 ? 0 : (page - 1) * DEFAULT_TICKET_PAGE_SIZE + 1;
  const to = Math.min(page * DEFAULT_TICKET_PAGE_SIZE, total);
  const pages = buildPaginationWindow(page, pageCount);
  const text = (value: string) => translatePosText(value, locale);

  function goTo(nextPage: number) {
    const clamped = Math.min(Math.max(1, nextPage), pageCount);
    if (clamped === page) {
      return;
    }
    const search = new URLSearchParams(params.toString());
    search.set(TICKET_FILTER_KEYS.page, String(clamped));
    search.delete(TICKET_FILTER_KEYS.pageSize);
    startTransition(() => {
      router.replace(`/tickets?${search.toString()}`, { scroll: false });
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">
        {formatTicketRange(from, to, total, locale)}
      </span>

      <div className="flex items-center gap-1">
        <PagerButton
          disabled={isPending || page <= 1}
          onClick={() => goTo(page - 1)}
        >
          {text("上一页")}
        </PagerButton>
        {pages.map((entry, index) =>
          entry === "..." ? (
            <span className="px-1.5 text-muted-foreground" key={`gap-${index}`}>
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
          {text("下一页")}
        </PagerButton>
      </div>
    </div>
  );
}

function formatTicketRange(
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
