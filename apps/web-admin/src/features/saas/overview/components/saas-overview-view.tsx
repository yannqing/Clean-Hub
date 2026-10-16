"use client";

import {
  Button,
  Icon,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@cleanhub/ui";
import {
  ArrowUp,
  ArrowUpRight,
  Building2,
  CircleCheck,
  CirclePause,
  HandCoins,
  LayoutDashboard,
  MessageSquareWarning,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  type FocusEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { webAdminRoutes } from "@/config/routes";
import { SaasMetricStrip } from "@/features/saas/shared";
import { getTenantListQuery } from "@/features/saas/tenants/queries";
import type { TenantSummary } from "@/features/saas/tenants/types";
import { getSaasUserListQuery } from "@/features/saas/users/queries";
import type { SaasUserSummary } from "@/features/saas/users/types";
import { useSaasI18n } from "@/i18n";
import { formatMoney } from "@/lib/format";

import { getSaasOverviewQuery } from "../queries";
import type { SaasOverview } from "../types";

export function SaasOverviewView() {
  const { m, locale } = useSaasI18n();
  const [overview, setOverview] = useState<SaasOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<{
    tenants: TenantSummary[];
    users: SaasUserSummary[];
  } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const searchRequestIdRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const canSend = query.trim().length > 0;
  const showSearchMode =
    contextMenuOpen ||
    (searchActive &&
      (searchResult !== null || searchLoading || searchError !== null));

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getSaasOverviewQuery();
      setOverview(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : m.overview.loadError,
      );
    } finally {
      setLoading(false);
    }
  }, [m.overview.loadError]);

  useEffect(() => {
    let isCurrent = true;

    getSaasOverviewQuery()
      .then((data) => {
        if (!isCurrent) {
          return;
        }

        setOverview(data);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (isCurrent) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : m.overview.loadError,
          );
        }
      })
      .finally(() => {
        if (isCurrent) {
          setLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [m.overview.loadError]);

  useEffect(() => {
    function handleDocumentPointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (searchAreaRef.current?.contains(target)) {
        return;
      }

      if (
        target instanceof Element &&
        target.closest('[data-testid="saas-home-search-quick-actions"]')
      ) {
        return;
      }

      setSearchActive(false);
      setContextMenuOpen(false);
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, []);

  const metricItems = [
    {
      icon: Building2,
      label: m.overview.metrics.tenants,
      value: overview?.tenantCount.toLocaleString() ?? "—",
    },
    {
      icon: CircleCheck,
      label: m.overview.metrics.activeTenants,
      value: overview?.activeTenantCount.toLocaleString() ?? "—",
    },
    {
      icon: CirclePause,
      label: m.overview.metrics.suspendedTenants,
      value: overview?.suspendedTenantCount.toLocaleString() ?? "—",
    },
    {
      icon: Store,
      label: m.overview.metrics.branches,
      value: overview?.branchCount.toLocaleString() ?? "—",
    },
    {
      icon: ShoppingBag,
      label: m.overview.metrics.todayOrders,
      value: overview?.todayOrderCount.toLocaleString() ?? "—",
    },
    {
      icon: HandCoins,
      label: m.overview.metrics.todayRevenue,
      value: overview
        ? overview.todayRevenueByCurrency
            .map(({ currency, amount }) =>
              formatMoney(amount, currency, locale),
            )
            .join(" · ") || "—"
        : "—",
    },
    {
      icon: MessageSquareWarning,
      label: m.overview.metrics.pendingFeedback,
      value: overview?.pendingFeedbackCount.toLocaleString() ?? "—",
    },
  ];
  const quickEntries = [
    {
      copy: m.overview.quickEntries.tenants,
      href: webAdminRoutes.saas.tenants,
      icon: Building2,
    },
    {
      copy: m.overview.quickEntries.users,
      href: webAdminRoutes.saas.users,
      icon: Users,
    },
    {
      copy: m.overview.quickEntries.feedback,
      href: webAdminRoutes.saas.feedbackTickets,
      icon: MessageSquareWarning,
    },
    {
      copy: m.overview.quickEntries.security,
      href: webAdminRoutes.saas.auditSecurity,
      icon: ShieldCheck,
    },
  ] as const;

  function handleSearchAreaBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;

    if (
      contextMenuOpen ||
      (nextTarget instanceof Node && event.currentTarget.contains(nextTarget))
    ) {
      return;
    }

    setSearchActive(false);
  }

  async function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const search = query.trim();
    if (!search) return;
    const requestId = ++searchRequestIdRef.current;
    setSearchActive(true);
    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);
    try {
      const [tenants, users] = await Promise.all([
        getTenantListQuery({ q: search, limit: 5, offset: 0 }),
        getSaasUserListQuery({ q: search, limit: 5, offset: 0 }),
      ]);
      if (requestId === searchRequestIdRef.current) {
        setSearchResult({ tenants: tenants.data, users });
      }
    } catch (searchFailure) {
      if (requestId === searchRequestIdRef.current) {
        setSearchError(
          searchFailure instanceof Error
            ? searchFailure.message
            : m.overview.loadError,
        );
      }
    } finally {
      if (requestId === searchRequestIdRef.current) setSearchLoading(false);
    }
  }

  return (
    <section
      className="mx-auto w-full max-w-5xl pb-8 pt-10"
      data-testid="saas-overview-view"
    >
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          {m.overview.welcomeTitle}
        </h1>

        <div
          className="relative mx-auto mt-6 w-full max-w-lg"
          onBlurCapture={handleSearchAreaBlur}
          onFocusCapture={() => setSearchActive(true)}
          ref={searchAreaRef}
        >
          <form className="relative" onSubmit={handleSearchSubmit}>
            <label className="sr-only" htmlFor="saas-home-search">
              {m.overview.searchLabel}
            </label>
            <Icon
              aria-hidden
              className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-muted-foreground"
              icon={Search}
              size={18}
            />
            <Input
              autoComplete="off"
              className="h-12 rounded-full border-border bg-background pl-11 pr-24 text-sm shadow-sm transition-shadow placeholder:text-muted-foreground focus-visible:shadow-md focus-visible:ring-2"
              data-testid="saas-home-search"
              id="saas-home-search"
              onChange={(event) => {
                searchRequestIdRef.current += 1;
                setQuery(event.target.value);
                setSearchResult(null);
                setSearchError(null);
                setSearchLoading(false);
              }}
              placeholder={m.overview.searchPlaceholder}
              ref={inputRef}
              role="searchbox"
              type="text"
              value={query}
            />

            <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1">
              <Popover
                onOpenChange={(open) => {
                  setContextMenuOpen(open);
                  if (open) {
                    setSearchActive(true);
                  }
                }}
                open={contextMenuOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    aria-label={m.overview.quickActionsLabel}
                    className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="button"
                    title={m.overview.quickActionsLabel}
                  >
                    <Icon aria-hidden icon={Plus} size={18} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-72 rounded-2xl p-2"
                  data-testid="saas-home-search-quick-actions"
                  sideOffset={8}
                >
                  {quickEntries.map((entry) => (
                    <Link
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      href={entry.href}
                      key={entry.href}
                      onClick={() => setContextMenuOpen(false)}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <Icon aria-hidden icon={entry.icon} size={17} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {entry.copy.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {entry.copy.description}
                        </span>
                      </span>
                    </Link>
                  ))}
                </PopoverContent>
              </Popover>

              <button
                aria-label={m.overview.sendLabel}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  canSend
                    ? "bg-foreground text-background hover:bg-foreground/85"
                    : "cursor-not-allowed bg-muted text-muted-foreground",
                )}
                disabled={!canSend}
                title={m.overview.sendLabel}
                type="submit"
              >
                <Icon aria-hidden icon={ArrowUp} size={18} />
              </button>
            </div>
          </form>

          <div
            aria-hidden={!showSearchMode}
            className={cn(
              "grid transition-[grid-template-rows,opacity,transform,margin] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none",
              showSearchMode
                ? "mt-5 grid-rows-[1fr] translate-y-0 opacity-100"
                : "pointer-events-none mt-0 grid-rows-[0fr] -translate-y-2 opacity-0",
            )}
            inert={!showSearchMode}
          >
            <div className="overflow-hidden">
              <div className="grid gap-2 text-left sm:grid-cols-2">
                {searchLoading ? (
                  <p className="col-span-full text-sm text-muted-foreground">
                    {m.overview.searchLoading}
                  </p>
                ) : searchError ? (
                  <p
                    className="col-span-full text-sm text-destructive"
                    role="alert"
                  >
                    {searchError}
                  </p>
                ) : searchResult ? (
                  searchResult.tenants.length + searchResult.users.length ===
                  0 ? (
                    <p className="col-span-full text-sm text-muted-foreground">
                      {m.overview.searchNoResults}
                    </p>
                  ) : (
                    <>
                      {searchResult.tenants.map((tenant) => (
                        <Link
                          className="rounded-xl border bg-background px-3 py-2 text-sm hover:bg-muted/60"
                          href={webAdminRoutes.saas.tenant(tenant.id)}
                          key={tenant.id}
                        >
                          <span className="block text-xs text-muted-foreground">
                            {m.overview.quickEntries.tenants.title}
                          </span>
                          <span className="block font-medium">
                            {tenant.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {tenant.pressingCode}
                          </span>
                        </Link>
                      ))}
                      {searchResult.users.map((user) => (
                        <Link
                          className="rounded-xl border bg-background px-3 py-2 text-sm hover:bg-muted/60"
                          href={webAdminRoutes.saas.user(user.id)}
                          key={user.id}
                        >
                          <span className="block text-xs text-muted-foreground">
                            {m.overview.quickEntries.users.title}
                          </span>
                          <span className="block font-medium">
                            {user.displayName}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {user.email ?? user.phone ?? user.id}
                          </span>
                        </Link>
                      ))}
                    </>
                  )
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        aria-hidden={showSearchMode}
        className={cn(
          "grid transition-[grid-template-rows,opacity,transform,margin] duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none",
          showSearchMode
            ? "pointer-events-none mt-0 grid-rows-[0fr] -translate-y-2 opacity-0"
            : "mt-10 grid-rows-[1fr] translate-y-0 opacity-100",
        )}
        inert={showSearchMode}
      >
        <div className="overflow-hidden">
          <div className="grid gap-4 pb-1 md:grid-cols-2 xl:grid-cols-4">
            {quickEntries.map((entry) => (
              <Link
                className="group flex min-h-36 flex-col justify-between rounded-2xl border bg-background p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-foreground/20 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
                href={entry.href}
                key={entry.href}
                tabIndex={showSearchMode ? -1 : undefined}
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-muted transition-[transform,background-color,color] duration-200 group-hover:scale-105 group-hover:bg-foreground group-hover:text-background">
                    <Icon aria-hidden icon={entry.icon} size={20} />
                  </span>
                  <Icon
                    aria-hidden
                    className="text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                    icon={ArrowUpRight}
                  />
                </div>
                <div className="mt-5">
                  <h2 className="text-base font-semibold">
                    {entry.copy.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                    {entry.copy.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10 space-y-3 border-t pt-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Icon aria-hidden icon={LayoutDashboard} size={16} />
            {m.overview.title}
          </h2>
          <Button
            aria-label={m.common.refresh}
            disabled={loading}
            onClick={loadOverview}
            size="icon-sm"
            title={m.common.refresh}
            type="button"
            variant="outline"
          >
            <Icon
              aria-hidden
              className={loading ? "animate-spin" : undefined}
              icon={RefreshCw}
              size={14}
            />
          </Button>
        </div>
        <SaasMetricStrip
          ariaLabel={m.overview.title}
          loading={loading}
          metrics={metricItems}
        />
      </div>

      {error ? (
        <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}
    </section>
  );
}
