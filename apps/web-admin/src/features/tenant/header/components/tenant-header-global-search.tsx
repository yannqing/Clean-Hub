"use client";

import type {
  TenantGlobalSearchEntityType,
  TenantGlobalSearchResponse,
} from "@cleanhub/api-client";
import { Icon, Input } from "@cleanhub/ui";
import {
  ArrowRight,
  BadgePercent,
  ChartNoAxesCombined,
  CircleAlert,
  ContactRound,
  HandCoins,
  LoaderCircle,
  Package,
  Search,
  Settings,
  ShoppingBag,
  Store,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";
import { webAdminApi } from "@/lib/api-client";

import type { TenantHeaderCopy } from "../types";

type TenantDataSearchGroup = keyof TenantGlobalSearchResponse["groups"];

type SearchShortcut = {
  description: string;
  href: string;
  icon: LucideIcon;
  id: string;
  label: string;
};

const dataGroupOrder: TenantDataSearchGroup[] = [
  "orders",
  "customers",
  "products",
  "services",
  "branches",
  "users",
];

const dataIcons: Record<TenantGlobalSearchEntityType, LucideIcon> = {
  order: ShoppingBag,
  customer: ContactRound,
  product: Package,
  service: Tags,
  branch: Store,
  user: Users,
};

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function TenantHeaderGlobalSearch({ copy }: { copy: TenantHeaderCopy }) {
  const { m } = useTenantI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<TenantGlobalSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const firstResultRef = useRef<HTMLAnchorElement>(null);
  const trimmedQuery = query.trim();
  const activeResult = result?.query === trimmedQuery ? result : null;
  const shortcuts = useMemo<SearchShortcut[]>(
    () => [
      {
        id: "orders",
        href: webAdminRoutes.tenant.orders,
        icon: ShoppingBag,
        ...copy.assistant.actions.orders,
      },
      {
        id: "customers",
        href: webAdminRoutes.tenant.customers,
        icon: ContactRound,
        ...copy.assistant.actions.customers,
      },
      {
        id: "products",
        href: webAdminRoutes.tenant.products,
        icon: Package,
        ...copy.assistant.actions.products,
      },
      {
        id: "services",
        href: webAdminRoutes.tenant.services,
        icon: Tags,
        ...copy.assistant.actions.services,
      },
      {
        id: "discounts",
        href: webAdminRoutes.tenant.discounts,
        icon: BadgePercent,
        ...copy.assistant.actions.discounts,
      },
      {
        id: "reports",
        href: webAdminRoutes.tenant.reports,
        icon: ChartNoAxesCombined,
        ...copy.assistant.actions.reports,
      },
      {
        id: "finance",
        href: webAdminRoutes.tenant.finance,
        icon: HandCoins,
        ...copy.assistant.actions.finance,
      },
      {
        id: "settings",
        href: webAdminRoutes.tenant.system.settings,
        icon: Settings,
        ...copy.assistant.actions.settings,
      },
      {
        id: "branches",
        href: webAdminRoutes.tenant.branches,
        icon: Store,
        label: m.overview.quickEntries.branches.title,
        description: m.overview.quickEntries.branches.description,
      },
    ],
    [copy.assistant.actions, m.overview.quickEntries.branches],
  );
  const normalizedQuery = normalizeSearchText(query);
  const matchingShortcuts = useMemo(
    () =>
      normalizedQuery
        ? shortcuts
            .filter((shortcut) =>
              normalizeSearchText(
                `${shortcut.label} ${shortcut.description}`,
              ).includes(normalizedQuery),
            )
            .slice(0, 4)
        : [],
    [normalizedQuery, shortcuts],
  );
  const dataGroups = dataGroupOrder
    .map((group) => ({
      group,
      label: m.overview.searchComposer.groupLabels[group],
      items: activeResult?.groups[group] ?? [],
    }))
    .filter(({ items }) => items.length > 0);
  const dataItems = dataGroups.flatMap(({ items }) => items);
  const resultCount = dataItems.length + matchingShortcuts.length;
  const badgeLabels: Record<
    TenantGlobalSearchEntityType,
    Record<string, string>
  > = {
    order: m.orders.paymentStatusLabels,
    customer: m.customers.statusLabels,
    product: m.products.statusLabels,
    service: m.common.statusLabels,
    branch: m.common.statusLabels,
    user: m.profile.statusLabels,
  };

  useEffect(() => {
    if (!trimmedQuery) {
      return;
    }

    const controller = new AbortController();
    let active = true;
    const timeoutId = window.setTimeout(() => {
      setLoading(true);

      webAdminApi.tenant.search
        .global({ q: trimmedQuery, limit: 3 }, { signal: controller.signal })
        .then((response) => {
          if (active) {
            setResult(response);
          }
        })
        .catch(() => {
          if (active && !controller.signal.aborted) {
            setLoadError(true);
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [trimmedQuery]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !searchAreaRef.current?.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    setResult(null);
    setLoadError(false);
    setLoading(false);
    setOpen(Boolean(value.trim()));
  }

  function closeAndClear() {
    setOpen(false);
    setQuery("");
    setResult(null);
    setLoadError(false);
    setLoading(false);
  }

  function openBestResult() {
    const href = dataItems[0]?.href ?? matchingShortcuts[0]?.href;

    if (href) {
      closeAndClear();
      router.push(href);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      openBestResult();
      return;
    }

    if (event.key === "ArrowDown" && resultCount > 0) {
      event.preventDefault();
      firstResultRef.current?.focus();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeAndClear();
    }
  }

  return (
    <div className="relative w-full max-w-xl" ref={searchAreaRef}>
      <label className="sr-only" htmlFor="tenant-global-search">
        {copy.searchLabel}
      </label>
      <Icon
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-white/55"
        icon={Search}
        size={17}
      />
      <Input
        aria-controls="tenant-header-search-results"
        aria-expanded={open && Boolean(trimmedQuery)}
        autoComplete="off"
        className="h-10 rounded-lg border-white/15 bg-white/10 pl-10 text-white shadow-none placeholder:text-white/45 hover:bg-white/[0.12] focus-visible:border-white/30 focus-visible:ring-white/20 dark:bg-white/10"
        data-testid="tenant-header-search"
        id="tenant-global-search"
        onChange={(event) => handleQueryChange(event.target.value)}
        onFocus={() => setOpen(Boolean(trimmedQuery))}
        onKeyDown={handleKeyDown}
        placeholder={copy.searchPlaceholder}
        role="combobox"
        type="search"
        value={query}
      />

      {open && trimmedQuery ? (
        <div
          aria-busy={loading}
          aria-live="polite"
          className="absolute left-0 right-0 top-full z-[60] mt-2 max-h-[70vh] overflow-y-auto rounded-xl border bg-popover p-3 text-popover-foreground shadow-2xl"
          data-testid="tenant-header-search-results"
          id="tenant-header-search-results"
        >
          <div className="flex items-center justify-between gap-3 px-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {m.overview.searchComposer.resultsTitle}
            </p>
            <span className="text-xs text-muted-foreground">
              {m.overview.searchComposer.resultCount.replace(
                "{count}",
                String(resultCount),
              )}
            </span>
          </div>

          {loading ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              <Icon
                aria-hidden
                className="animate-spin"
                icon={LoaderCircle}
                size={15}
              />
              {m.overview.searchComposer.loadingLabel}
            </div>
          ) : null}

          {loadError ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <Icon aria-hidden icon={CircleAlert} size={15} />
              {m.overview.searchComposer.loadError}
            </div>
          ) : null}

          {dataGroups.length > 0 ? (
            <div className="mt-3 grid gap-3">
              {dataGroups.map((dataGroup) => (
                <section key={dataGroup.group}>
                  <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {dataGroup.label}
                  </p>
                  <div className="grid gap-1">
                    {dataGroup.items.map((item) => {
                      const ResultIcon = dataIcons[item.type];

                      return (
                        <Link
                          className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          href={item.href}
                          key={`${item.type}-${item.id}`}
                          onClick={closeAndClear}
                          ref={
                            item === dataItems[0] ? firstResultRef : undefined
                          }
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                            <Icon aria-hidden icon={ResultIcon} size={15} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {item.title}
                              </span>
                              {item.badge ? (
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
                                  {badgeLabels[item.type][item.badge] ??
                                    item.badge}
                                </span>
                              ) : null}
                            </span>
                            {item.subtitle ? (
                              <span className="block truncate text-xs text-muted-foreground">
                                {item.subtitle}
                              </span>
                            ) : null}
                          </span>
                          <Icon
                            aria-hidden
                            className="shrink-0 text-muted-foreground"
                            icon={ArrowRight}
                            size={14}
                          />
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {matchingShortcuts.length > 0 ? (
            <section className="mt-3 border-t pt-3">
              <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {m.overview.searchComposer.navigationResultsTitle}
              </p>
              <div className="grid gap-1">
                {matchingShortcuts.map((shortcut, index) => (
                  <Link
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={shortcut.href}
                    key={shortcut.id}
                    onClick={closeAndClear}
                    ref={
                      dataItems.length === 0 && index === 0
                        ? firstResultRef
                        : undefined
                    }
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <Icon aria-hidden icon={shortcut.icon} size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {shortcut.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {shortcut.description}
                      </span>
                    </span>
                    <Icon
                      aria-hidden
                      className="shrink-0 text-muted-foreground"
                      icon={ArrowRight}
                      size={14}
                    />
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {!loading && !loadError && resultCount === 0 ? (
            <div className="mt-2 rounded-lg border border-dashed px-4 py-6 text-center">
              <p className="text-sm font-medium">
                {m.overview.searchComposer.emptyTitle}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {m.overview.searchComposer.emptyDescription}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
