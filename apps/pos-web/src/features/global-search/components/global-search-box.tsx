"use client";

import type {
  PosGlobalSearchItem,
  PosGlobalSearchResponse,
} from "@cleanhub/api-client";
import type { TranslationKey } from "@cleanhub/i18n";
import { isPosOrderLookupQuery } from "@cleanhub/domain/order-codes";
import { useTranslation } from "@cleanhub/i18n/react";
import { cn } from "@cleanhub/ui";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import { Icon } from "@/components/app-shell/icons";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { posRoutes } from "@/config";
import { posApi } from "@/lib/api-client";
import { formatPosMoney } from "@/lib/money";

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_LIMIT = 5;

type SearchStatus = "idle" | "loading" | "success" | "error";
type GlobalSearchBoxVariant = "default" | "dark";

type GlobalSearchBoxProps = {
  className?: string;
  variant?: GlobalSearchBoxVariant;
};

type SearchGroup = {
  key: keyof PosGlobalSearchResponse["groups"];
  label: string;
  items: PosGlobalSearchItem[];
};

const ENTITY_ICON: Record<
  PosGlobalSearchItem["type"],
  "users" | "clipboard-list" | "receipt"
> = {
  customer: "users",
  ticket: "clipboard-list",
  order: "receipt",
};

const BADGE_LABEL_KEYS: Record<string, TranslationKey> = {
  active: "pos.globalSearch.status.active",
  disabled: "pos.globalSearch.status.disabled",
  draft: "pos.globalSearch.status.draft",
  pending: "pos.globalSearch.status.pending",
  in_progress: "pos.globalSearch.status.inProgress",
  ready_to_pick: "pos.globalSearch.status.readyToPick",
  picked_up: "pos.globalSearch.status.pickedUp",
  received: "pos.globalSearch.status.received",
  unpaid: "pos.globalSearch.status.unpaid",
  paid: "pos.globalSearch.status.paid",
  partial: "pos.globalSearch.status.partial",
  delivered: "pos.globalSearch.status.delivered",
  cancelled: "pos.globalSearch.status.cancelled",
  exception: "pos.globalSearch.status.exception",
  refunded: "pos.globalSearch.status.refunded",
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function getFallbackHref(query: string): string {
  const encoded = encodeURIComponent(query);

  if (/^TK-/i.test(query)) {
    return `${posRoutes.tickets}?q=${encoded}`;
  }
  if (isPosOrderLookupQuery(query)) {
    return `${posRoutes.orders}?q=${encoded}`;
  }
  return `${posRoutes.customers}?q=${encoded}`;
}

function formatAmount(
  amount: string | null | undefined,
  currency: string,
  locale: string,
): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return "";
  }

  return formatPosMoney(value, currency, locale);
}

export function GlobalSearchBox({
  className,
  variant = "default",
}: GlobalSearchBoxProps = {}) {
  const router = useRouter();
  const { locale, t } = useTranslation();
  const { currency } = usePosRuntimeConfig();
  const inputId = useId();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [result, setResult] = useState<PosGlobalSearchResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmedQuery = query.trim();
  const canSearch = trimmedQuery.length >= MIN_QUERY_LENGTH;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!canSearch) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setStatus("loading");
      void posApi.pos.search
        .global(
          { q: trimmedQuery, limit: SEARCH_LIMIT },
          { signal: controller.signal },
        )
        .then((nextResult) => {
          setResult(nextResult);
          setStatus("success");
          setActiveIndex(0);
          setOpen(true);
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return;
          }
          setResult(null);
          setStatus("error");
          setOpen(true);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [canSearch, trimmedQuery]);

  const groups = useMemo<SearchGroup[]>(() => {
    if (!result) {
      return [];
    }

    const nextGroups: SearchGroup[] = [
      {
        key: "customers",
        label: t("pos.globalSearch.groups.customers"),
        items: result.groups.customers,
      },
      {
        key: "tickets",
        label: t("pos.globalSearch.groups.tickets"),
        items: result.groups.tickets,
      },
      {
        key: "orders",
        label: t("pos.globalSearch.groups.orders"),
        items: result.groups.orders,
      },
    ];

    return nextGroups.filter((group) => group.items.length > 0);
  }, [result, t]);

  const flatItems = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups],
  );

  const showPanel = open && (canSearch || status === "error");
  const hasResults = flatItems.length > 0;
  const activeItemId = hasResults
    ? `${listboxId}-option-${activeIndex}`
    : undefined;

  function navigateTo(item: PosGlobalSearchItem | undefined) {
    const href = item?.href ?? getFallbackHref(trimmedQuery);

    if (!href) {
      return;
    }

    setOpen(false);
    router.push(href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown" && hasResults) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % flatItems.length);
      return;
    }

    if (event.key === "ArrowUp" && hasResults) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex(
        (current) => (current - 1 + flatItems.length) % flatItems.length,
      );
      return;
    }

    if (event.key === "Enter" && trimmedQuery) {
      event.preventDefault();
      navigateTo(flatItems[activeIndex]);
    }
  }

  function getBadgeLabel(badge: string | undefined): string | null {
    if (!badge) {
      return null;
    }

    const labelKey = BADGE_LABEL_KEYS[badge];
    return labelKey ? t(labelKey) : badge.replace(/_/g, " ");
  }

  function getMetadataLabel(item: PosGlobalSearchItem): string | null {
    const parts: string[] = [];

    if (typeof item.metadata?.itemCount === "number") {
      parts.push(
        t("pos.globalSearch.itemCount", {
          count: item.metadata.itemCount,
        }),
      );
    }

    const amount = formatAmount(item.metadata?.totalAmount, currency, locale);
    if (amount) {
      parts.push(t("pos.globalSearch.amount", { amount }));
    }

    return parts.length > 0 ? parts.join(" · ") : null;
  }

  function renderPanelContent() {
    if (status === "loading") {
      return (
        <div className="px-4 py-5 text-sm font-medium text-muted-foreground">
          {t("pos.globalSearch.loading")}
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="px-4 py-5">
          <div className="text-sm font-semibold text-foreground">
            {t("pos.globalSearch.errorTitle")}
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">
            {t("pos.globalSearch.errorHint")}
          </div>
        </div>
      );
    }

    if (!hasResults) {
      return (
        <div className="px-4 py-5">
          <div className="text-sm font-semibold text-foreground">
            {canSearch
              ? t("pos.globalSearch.emptyTitle")
              : t("pos.globalSearch.minLengthTitle")}
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground">
            {canSearch
              ? t("pos.globalSearch.emptyHint")
              : t("pos.globalSearch.minLengthHint")}
          </div>
        </div>
      );
    }

    let optionIndex = -1;

    return groups.map((group) => (
      <div key={group.key} className="py-2">
        <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {group.label}
        </div>
        <div className="space-y-1 px-2">
          {group.items.map((item) => {
            optionIndex += 1;
            const active = optionIndex === activeIndex;
            const badgeLabel = getBadgeLabel(item.badge);
            const metadataLabel = getMetadataLabel(item);

            return (
              <button
                aria-selected={active}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-muted text-foreground"
                    : "text-foreground hover:bg-muted/60",
                )}
                id={`${listboxId}-option-${optionIndex}`}
                key={`${item.type}:${item.id}`}
                onClick={() => navigateTo(item)}
                onMouseEnter={() => setActiveIndex(optionIndex)}
                role="option"
                type="button"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    active
                      ? "bg-background text-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" name={ENTITY_ICON[item.type]} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-medium text-muted-foreground">
                    {[item.subtitle, metadataLabel].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {badgeLabel ? (
                  <span className="max-w-24 shrink-0 truncate rounded-full bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
                    {badgeLabel}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    ));
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative w-full min-w-0 max-w-xl", className)}
    >
      <div
        className={cn(
          "flex w-full items-center rounded-lg border px-3 transition",
          variant === "dark"
            ? "h-10 border-white/15 bg-white/10 focus-within:border-white/30 focus-within:bg-white/[0.14] focus-within:ring-2 focus-within:ring-white/10"
            : "h-12 border-border bg-muted/50 focus-within:border-ring focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/20",
        )}
      >
        <Icon
          className={cn(
            "mr-2.5 h-[18px] w-[18px]",
            variant === "dark" ? "text-white/55" : "text-muted-foreground",
          )}
          name="search"
        />
        <input
          aria-activedescendant={activeItemId}
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={showPanel}
          aria-label={t("pos.globalSearch.label")}
          className={cn(
            "h-full min-w-0 flex-1 bg-transparent text-sm font-medium outline-none",
            variant === "dark"
              ? "text-white placeholder:text-white/45"
              : "text-foreground placeholder:text-muted-foreground",
          )}
          id={inputId}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (nextQuery.trim().length < MIN_QUERY_LENGTH) {
              setResult(null);
              setStatus("idle");
              setActiveIndex(0);
            } else {
              setStatus("loading");
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t("pos.globalSearch.placeholder")}
          role="combobox"
          value={query}
        />
        <button
          className={cn(
            "ml-2 flex shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition",
            variant === "dark"
              ? "h-8 bg-white/10 text-white/75 hover:bg-white/15 hover:text-white"
              : "h-10 bg-background text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
          onClick={() => router.push(posRoutes.scan)}
          type="button"
        >
          <Icon className="h-3.5 w-3.5" name="scan-line" />
          {t("pos.shell.scan")}
        </button>
      </div>

      {showPanel ? (
        <div
          className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[430px] overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-xl"
          id={listboxId}
          role="listbox"
        >
          <div className="pos-scrollbar max-h-[430px] overflow-y-auto">
            {renderPanelContent()}
          </div>
        </div>
      ) : null}
    </div>
  );
}
