"use client";

import type { AuthContext } from "@cleanhub/api-client";
import { Button, Input, Label, cn } from "@cleanhub/ui";
import {
  Banknote,
  CircleDollarSign,
  CreditCard,
  Printer,
  ReceiptText,
  Search,
  SquareTerminal,
  Store,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";
import { webAdminApi } from "@/lib/api-client";

import { getTenantSettingsQuery } from "../queries";
import type { TenantSettings } from "../types";

export type TenantSettingsNavigationKey =
  | "general"
  | "pricing"
  | "payments"
  | "cash"
  | "pointOfSale"
  | "printing"
  | "hardware";

export type TenantSettingsNavigationItem = {
  href: string;
  icon: LucideIcon;
  key: TenantSettingsNavigationKey;
};

export const tenantSettingsNavigationItems: TenantSettingsNavigationItem[] = [
  {
    key: "general",
    href: webAdminRoutes.tenant.system.settingsSections.general,
    icon: Store,
  },
  {
    key: "pricing",
    href: webAdminRoutes.tenant.system.settingsSections.pricing,
    icon: CircleDollarSign,
  },
  {
    key: "payments",
    href: webAdminRoutes.tenant.system.settingsSections.payments,
    icon: CreditCard,
  },
  {
    key: "cash",
    href: webAdminRoutes.tenant.system.settingsSections.cash,
    icon: Banknote,
  },
  {
    key: "pointOfSale",
    href: webAdminRoutes.tenant.system.settingsSections.pointOfSale,
    icon: SquareTerminal,
  },
  {
    key: "printing",
    href: webAdminRoutes.tenant.system.settingsSections.printing,
    icon: ReceiptText,
  },
  {
    key: "hardware",
    href: webAdminRoutes.tenant.system.settingsSections.hardware,
    icon: Printer,
  },
];

type TenantSettingsWorkspaceContextValue = {
  authContext: AuthContext | null;
  authError: string | null;
  authLoaded: boolean;
  canUpdateSettings: boolean;
  settings: TenantSettings;
  updateSettings: (settings: TenantSettings) => void;
};

const TenantSettingsWorkspaceContext =
  createContext<TenantSettingsWorkspaceContextValue | null>(null);

export function useTenantSettingsWorkspace() {
  const context = useContext(TenantSettingsWorkspaceContext);

  if (!context) {
    throw new Error(
      "useTenantSettingsWorkspace must be used inside TenantSettingsWorkspace.",
    );
  }

  return context;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getInitials(value: string): string {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "CH";
}

function isActiveSettingsPath(pathname: string, href: string): boolean {
  if (href === webAdminRoutes.tenant.system.settingsSections.general) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveNavigationItem(pathname: string) {
  return (
    tenantSettingsNavigationItems.find((item) =>
      isActiveSettingsPath(pathname, item.href),
    ) ?? tenantSettingsNavigationItems[0]
  );
}

export type TenantSettingsWorkspaceProps = {
  children: ReactNode;
  initialAuthContext?: AuthContext | null;
  initialSettings?: TenantSettings;
};

export function TenantSettingsWorkspace({
  children,
  initialAuthContext,
  initialSettings,
}: TenantSettingsWorkspaceProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { m } = useTenantI18n();
  const [authContext, setAuthContext] = useState<AuthContext | null>(
    initialAuthContext ?? null,
  );
  const [authLoaded, setAuthLoaded] = useState(
    initialAuthContext !== undefined,
  );
  const [authError, setAuthError] = useState<string | null>(null);
  const [settings, setSettings] = useState<TenantSettings | null>(
    initialSettings ?? null,
  );
  const [loading, setLoading] = useState(!initialSettings);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navigationQuery, setNavigationQuery] = useState("");

  const activeItem = getActiveNavigationItem(pathname);
  const wideContent = !["general", "pointOfSale"].includes(activeItem.key);
  const filteredNavigationItems = useMemo(() => {
    const normalizedQuery = navigationQuery.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return tenantSettingsNavigationItems;
    }

    return tenantSettingsNavigationItems.filter((item) =>
      m.settings.navigation.items[item.key]
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [m.settings.navigation.items, navigationQuery]);

  async function loadWorkspace() {
    setLoading(true);
    setLoadError(null);

    const [settingsResult, authResult] = await Promise.allSettled([
      getTenantSettingsQuery(),
      webAdminApi.auth.me(),
    ]);

    setAuthContext(authResult.status === "fulfilled" ? authResult.value : null);
    setAuthError(
      authResult.status === "fulfilled" ? null : m.settings.permissionDenied,
    );
    setAuthLoaded(true);

    if (settingsResult.status === "fulfilled") {
      setSettings(settingsResult.value);
    } else {
      setSettings(null);
      setLoadError(
        getErrorMessage(settingsResult.reason, m.settings.requestFailed),
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    let isCurrent = true;

    Promise.allSettled([
      initialSettings
        ? Promise.resolve(initialSettings)
        : getTenantSettingsQuery(),
      initialAuthContext !== undefined
        ? Promise.resolve(initialAuthContext)
        : webAdminApi.auth.me(),
    ])
      .then(([settingsResult, authResult]) => {
        if (!isCurrent) {
          return;
        }

        setAuthContext(
          authResult.status === "fulfilled" ? authResult.value : null,
        );
        setAuthError(
          authResult.status === "fulfilled"
            ? null
            : m.settings.permissionDenied,
        );
        setAuthLoaded(true);

        if (settingsResult.status === "fulfilled") {
          setSettings(settingsResult.value);
          setLoadError(null);
        } else {
          setSettings(null);
          setLoadError(
            getErrorMessage(settingsResult.reason, m.settings.requestFailed),
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
  }, [
    initialAuthContext,
    initialSettings,
    m.settings.permissionDenied,
    m.settings.requestFailed,
  ]);

  if (loading) {
    return (
      <section className="min-h-[calc(100vh-4rem)] bg-[#f1f1f1] px-4 py-5">
        <div className="mx-auto grid max-w-[1120px] gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="h-[640px] animate-pulse rounded-xl bg-white" />
          <div className="grid content-start gap-4">
            <div className="h-12 w-48 animate-pulse rounded-md bg-white" />
            <div className="h-40 animate-pulse rounded-xl bg-white" />
            <div className="h-96 animate-pulse rounded-xl bg-white" />
          </div>
        </div>
      </section>
    );
  }

  if (loadError || !settings) {
    return (
      <section className="min-h-[calc(100vh-4rem)] bg-[#f1f1f1] px-4 py-8">
        <div className="mx-auto max-w-2xl rounded-xl border border-destructive/30 bg-white p-5 text-sm text-destructive shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <span>{loadError ?? m.settings.unavailable}</span>
            <Button
              onClick={loadWorkspace}
              size="sm"
              type="button"
              variant="outline"
            >
              {m.common.retry}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  const tenantInitials = getInitials(settings.tenantName);
  const accountName =
    authContext?.displayName.trim() || m.settings.navigation.accountFallback;
  const canUpdateSettings =
    authContext?.role === "owner" && authContext.tenantId === settings.tenantId;
  const ActiveIcon = activeItem.icon;
  const contextValue: TenantSettingsWorkspaceContextValue = {
    authContext,
    authError,
    authLoaded,
    canUpdateSettings,
    settings,
    updateSettings: setSettings,
  };

  return (
    <TenantSettingsWorkspaceContext.Provider value={contextValue}>
      <section
        className="min-h-[calc(100vh-4rem)] bg-[#f1f1f1] px-3 py-4 sm:px-5 sm:py-5"
        data-testid="tenant-settings-workspace"
      >
        <div
          className={cn(
            "mx-auto grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]",
            wideContent ? "max-w-[1440px]" : "max-w-[1120px]",
          )}
        >
          <aside
            className="overflow-hidden rounded-xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] lg:sticky lg:top-20 lg:flex lg:h-[calc(100vh-6rem)] lg:flex-col"
            data-testid="tenant-settings-sidebar"
          >
            <div className="border-b border-black/10 px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500 text-sm font-semibold text-white">
                  {tenantInitials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-950">
                    {settings.tenantName}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-slate-500">
                    {m.settings.navigation.workspaceSubtitle}
                  </span>
                </span>
              </div>
            </div>

            <div className="border-b border-black/10 p-3">
              <Label className="sr-only" htmlFor="tenant-settings-search">
                {m.settings.navigation.searchLabel}
              </Label>
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                />
                <Input
                  className="h-9 rounded-lg border-slate-300 bg-white pl-9 text-sm shadow-none"
                  id="tenant-settings-search"
                  onChange={(event) => setNavigationQuery(event.target.value)}
                  placeholder={m.settings.navigation.searchPlaceholder}
                  type="search"
                  value={navigationQuery}
                />
              </div>
            </div>

            <nav
              aria-label={m.settings.navigation.ariaLabel}
              className="grid gap-1 p-3 lg:min-h-0 lg:flex-1 lg:content-start lg:overflow-y-auto"
            >
              {filteredNavigationItems.map((item) => {
                const active = item.key === activeItem.key;
                const NavigationIcon = item.icon;

                return (
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
                      active
                        ? "bg-slate-100 text-slate-950"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-950",
                    )}
                    href={item.href}
                    key={item.key}
                  >
                    <NavigationIcon
                      aria-hidden
                      className="size-4 shrink-0 text-slate-600"
                    />
                    <span className="truncate">
                      {m.settings.navigation.items[item.key]}
                    </span>
                  </Link>
                );
              })}

              {filteredNavigationItems.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">
                  {m.settings.navigation.noResults}
                </p>
              ) : null}
            </nav>

            <div className="hidden border-t border-black/10 p-3 lg:block">
              <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-700">
                  {getInitials(accountName)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-slate-900">
                    {accountName}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {authContext
                      ? m.settings.navigation.roleLabels[authContext.role]
                      : m.settings.navigation.accountFallback}
                  </span>
                </span>
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mb-4 flex min-h-10 items-start justify-between gap-4 px-1">
              <div className="flex min-w-0 items-start gap-2">
                <ActiveIcon
                  aria-hidden
                  className="mt-0.5 size-5 shrink-0 text-slate-700"
                />
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-semibold tracking-tight text-slate-950">
                    {m.settings.navigation.items[activeItem.key]}
                  </h1>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {m.settings.general.resourceDescriptions[activeItem.key]}
                  </p>
                </div>
              </div>
              <Button
                aria-label={m.settings.navigation.closeLabel}
                className="size-9 shrink-0 rounded-lg text-slate-600 hover:bg-black/5 hover:text-slate-950"
                onClick={() => router.push(webAdminRoutes.tenant.home)}
                size="icon"
                title={m.settings.navigation.closeLabel}
                type="button"
                variant="ghost"
              >
                <X aria-hidden className="size-5" />
              </Button>
            </div>

            {children}
          </main>
        </div>
      </section>
    </TenantSettingsWorkspaceContext.Provider>
  );
}
