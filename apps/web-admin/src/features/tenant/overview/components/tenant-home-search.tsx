"use client";

import {
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
  AtSign,
  ChartNoAxesCombined,
  Check,
  ClipboardList,
  FileText,
  Plus,
  Printer,
  Search,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  type FocusEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";

type SearchContextType = "file" | "mention" | "branch" | "user";

export function TenantHomeSearch() {
  const { m } = useTenantI18n();
  const [query, setQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [selectedContextType, setSelectedContextType] =
    useState<SearchContextType | null>(null);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canSend = query.trim().length > 0;
  const showSearchMode = isSearchActive || isContextMenuOpen;
  const quickEntries = [
    {
      copy: m.overview.quickEntries.branches,
      href: webAdminRoutes.tenant.branches,
      icon: Store,
    },
    {
      copy: m.overview.quickEntries.services,
      href: webAdminRoutes.tenant.services,
      icon: ClipboardList,
    },
    {
      copy: m.overview.quickEntries.hardware,
      href: webAdminRoutes.tenant.hardware,
      icon: Printer,
    },
    {
      copy: m.overview.quickEntries.reports,
      href: webAdminRoutes.tenant.reports,
      icon: ChartNoAxesCombined,
    },
  ] as const;
  const contextTypes = [
    {
      id: "file",
      copy: m.overview.searchComposer.contextTypes.file,
      icon: FileText,
    },
    {
      id: "mention",
      copy: m.overview.searchComposer.contextTypes.mention,
      icon: AtSign,
    },
    {
      id: "branch",
      copy: m.overview.searchComposer.contextTypes.branch,
      icon: Store,
    },
    {
      id: "user",
      copy: m.overview.searchComposer.contextTypes.user,
      icon: Users,
    },
  ] as const;
  const selectedContextLabel = contextTypes.find(
    (contextType) => contextType.id === selectedContextType,
  )?.copy.label;
  const addContextLabel = selectedContextLabel
    ? `${m.overview.searchComposer.addContextLabel}: ${selectedContextLabel}`
    : m.overview.searchComposer.addContextLabel;

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
        target.closest('[data-testid="tenant-home-search-context-menu"]')
      ) {
        return;
      }

      setIsSearchActive(false);
      setIsContextMenuOpen(false);
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, []);

  function handleSearchAreaBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;

    if (isContextMenuOpen) {
      return;
    }

    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    setIsSearchActive(false);
    setIsContextMenuOpen(false);
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    setQuery(query.trim());
    inputRef.current?.focus();
  }

  function handleContextTypeSelect(contextType: SearchContextType) {
    setSelectedContextType(contextType);
    setIsContextMenuOpen(false);
    inputRef.current?.focus();
  }

  function handleRecommendationSelect(recommendation: string) {
    setQuery(recommendation);
    inputRef.current?.focus();
  }

  return (
    <section
      className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-5xl flex-col justify-start pb-8 pt-14"
      data-testid="tenant-home-search-panel"
    >
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          {m.overview.welcomeTitle}
        </h1>

        <div
          className="relative mx-auto mt-6 w-full max-w-lg"
          onBlurCapture={handleSearchAreaBlur}
          onFocusCapture={() => setIsSearchActive(true)}
          ref={searchAreaRef}
        >
          <form className="relative" onSubmit={handleSearchSubmit}>
            <label className="sr-only" htmlFor="tenant-home-search">
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
              data-testid="tenant-home-search"
              id="tenant-home-search"
              inputMode="search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={m.overview.searchPlaceholder}
              ref={inputRef}
              role="searchbox"
              type="text"
              value={query}
            />

            <div className="absolute right-2 top-1/2 z-20 flex -translate-y-1/2 items-center gap-1">
              <Popover
                onOpenChange={(open) => {
                  setIsContextMenuOpen(open);

                  if (open) {
                    setIsSearchActive(true);
                  }
                }}
                open={isContextMenuOpen}
              >
                <PopoverTrigger asChild>
                  <button
                    aria-label={addContextLabel}
                    className="relative flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="tenant-home-search-add-context"
                    title={addContextLabel}
                    type="button"
                  >
                    <Icon aria-hidden icon={Plus} size={18} />
                    {selectedContextType ? (
                      <span className="absolute right-0.5 top-0.5 size-1.5 rounded-full bg-foreground ring-2 ring-background" />
                    ) : null}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  aria-label={m.overview.searchComposer.contextMenuLabel}
                  className="w-72 rounded-2xl p-2"
                  data-testid="tenant-home-search-context-menu"
                  sideOffset={8}
                >
                  {contextTypes.map((contextType) => {
                    const ContextIcon = contextType.icon;
                    const selected = selectedContextType === contextType.id;

                    return (
                      <button
                        aria-pressed={selected}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        key={contextType.id}
                        onClick={() => handleContextTypeSelect(contextType.id)}
                        type="button"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                          <Icon aria-hidden icon={ContextIcon} size={17} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">
                            {contextType.copy.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {contextType.copy.description}
                          </span>
                        </span>
                        {selected ? (
                          <Icon
                            aria-hidden
                            className="text-foreground"
                            icon={Check}
                            size={16}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
              <button
                aria-label={m.overview.searchComposer.sendLabel}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  canSend
                    ? "bg-foreground text-background hover:bg-foreground/85"
                    : "cursor-not-allowed bg-muted text-muted-foreground",
                )}
                data-testid="tenant-home-search-send"
                disabled={!canSend}
                title={m.overview.searchComposer.sendLabel}
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
            data-testid="tenant-home-search-recommendations-transition"
            inert={!showSearchMode}
          >
            <div className="overflow-hidden">
              <div data-testid="tenant-home-search-recommendations">
                <p className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {m.overview.searchComposer.recommendationsTitle}
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {m.overview.searchComposer.recommendations.map(
                    (recommendation) => (
                      <button
                        className="group flex min-h-12 items-center gap-3 rounded-xl border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        key={recommendation}
                        onClick={() =>
                          handleRecommendationSelect(recommendation)
                        }
                        tabIndex={showSearchMode ? 0 : -1}
                        type="button"
                      >
                        <Icon
                          aria-hidden
                          className="text-muted-foreground transition-colors group-hover:text-foreground"
                          icon={Sparkles}
                          size={16}
                        />
                        <span>{recommendation}</span>
                      </button>
                    ),
                  )}
                </div>
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
        data-testid="tenant-home-quick-entries-transition"
        inert={showSearchMode}
      >
        <div className="overflow-hidden">
          <div
            className="grid gap-4 pb-1 md:grid-cols-2 xl:grid-cols-3"
            data-testid="tenant-home-quick-entries"
          >
            {quickEntries.map((entry) => {
              const EntryIcon = entry.icon;

              return (
                <Link
                  className="group flex min-h-36 flex-col justify-between rounded-2xl border bg-background p-5 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-1 hover:border-foreground/20 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
                  href={entry.href}
                  key={entry.href}
                  tabIndex={showSearchMode ? -1 : undefined}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-muted text-foreground transition-[transform,background-color,color] duration-200 group-hover:scale-105 group-hover:bg-foreground group-hover:text-background">
                      <Icon aria-hidden icon={EntryIcon} size={20} />
                    </span>
                    <Icon
                      aria-hidden
                      className="text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
                      icon={ArrowUpRight}
                    />
                  </div>
                  <div className="mt-5">
                    <h2 className="text-lg font-semibold">
                      {entry.copy.title}
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                      {entry.copy.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
