"use client";

import type { AuthContext } from "@cleanhub/api-client";
import { Card, CardContent, Icon, cn } from "@cleanhub/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { filterSidebarSections } from "@/config/feature-visibility";
import { getNavIcon } from "@/config/nav-icons";
import { webAdminRoutes } from "@/config/routes";
import { getAuthSessionQuery } from "@/features/auth/queries";
import {
  TENANT_PROFILE_UPDATED_EVENT,
  type TenantProfileUpdatedEventDetail,
} from "@/features/tenant/profile/events";
import { useWebAdminLocale } from "@/i18n";

import { TenantGlobalHeader } from "./tenant-global-header";

type TenantDashboardShellProps = {
  children: React.ReactNode;
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === webAdminRoutes.tenant.home) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getRoleLabel(authContext: AuthContext | null): string {
  if (!authContext) {
    return "Admin User";
  }

  return authContext.role
    .split("_")
    .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getDisplayName(authContext: AuthContext | null): string {
  return authContext?.displayName.trim() || getRoleLabel(authContext);
}

export function TenantDashboardShell({ children }: TenantDashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { messages } = useWebAdminLocale();
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const sidebarItems = useMemo(
    () =>
      filterSidebarSections(messages.sidebar.tenant)
        .flatMap((section) => section.items)
        .filter((item) => item.href !== webAdminRoutes.tenant.system.settings),
    [messages.sidebar.tenant],
  );
  const settingsHref = webAdminRoutes.tenant.system.settings;
  const settingsActive = isActivePath(pathname, settingsHref);
  const SettingsIcon = getNavIcon(settingsHref);
  const isHomePage = pathname === webAdminRoutes.tenant.home;
  const isBranchesPage = isActivePath(pathname, webAdminRoutes.tenant.branches);
  const isHardwarePage = isActivePath(pathname, webAdminRoutes.tenant.hardware);
  const isOrdersPage = isActivePath(pathname, webAdminRoutes.tenant.orders);
  const isCustomersPage = isActivePath(
    pathname,
    webAdminRoutes.tenant.customers,
  );
  const isProductsPage = isActivePath(pathname, webAdminRoutes.tenant.products);
  const isDiscountsPage = isActivePath(
    pathname,
    webAdminRoutes.tenant.discounts,
  );
  const isServicesPage = isActivePath(pathname, webAdminRoutes.tenant.services);
  const isReportsPage = isActivePath(pathname, webAdminRoutes.tenant.reports);
  const isFinancePage = isActivePath(pathname, webAdminRoutes.tenant.finance);
  const isSystemLogsPage = isActivePath(pathname, webAdminRoutes.tenant.system.logs);
  const isNotificationsPage = isActivePath(
    pathname,
    webAdminRoutes.tenant.notifications,
  );
  const isPointOfSalePage = isActivePath(
    pathname,
    webAdminRoutes.tenant.pointOfSale.home,
  );
  const isProfilePage = isActivePath(pathname, webAdminRoutes.tenant.profile);
  const isSettingsWorkspace = isActivePath(
    pathname,
    webAdminRoutes.tenant.system.settings,
  );
  const usesFlatPageLayout =
    isHomePage ||
    isBranchesPage ||
    isHardwarePage ||
    isOrdersPage ||
    isCustomersPage ||
    isProductsPage ||
    isDiscountsPage ||
    isServicesPage ||
    isReportsPage ||
    isFinancePage ||
    isSystemLogsPage ||
    isNotificationsPage ||
    isPointOfSalePage ||
    isProfilePage;
  const serviceActive = isActivePath(pathname, webAdminRoutes.tenant.services);
  const pointOfSaleTabs = [
    {
      href: webAdminRoutes.tenant.pointOfSale.home,
      label: messages.tenant.pointOfSale.tabs.overview,
    },
    {
      href: webAdminRoutes.tenant.pointOfSale.devices,
      label: messages.tenant.pointOfSale.tabs.devices,
    },
    {
      href: webAdminRoutes.tenant.pointOfSale.registerSessions,
      label: messages.tenant.pointOfSale.tabs.registerSessions,
    },
    {
      href: webAdminRoutes.tenant.pointOfSale.settings,
      label: messages.tenant.pointOfSale.tabs.settings,
    },
  ];
  const displayName = useMemo(() => getDisplayName(authContext), [authContext]);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const session = await getAuthSessionQuery();

      if (!active) {
        return;
      }

      if (session) {
        setAuthContext(session);
      } else {
        router.replace(webAdminRoutes.login);
      }
    }

    loadSession();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    function handleProfileUpdated(event: Event) {
      const detail = (event as CustomEvent<TenantProfileUpdatedEventDetail>)
        .detail;

      if (!detail?.displayName) {
        return;
      }

      setAuthContext((current) =>
        current
          ? {
              ...current,
              displayName: detail.displayName,
            }
          : current,
      );
    }

    window.addEventListener(
      TENANT_PROFILE_UPDATED_EVENT,
      handleProfileUpdated,
    );

    return () => {
      window.removeEventListener(
        TENANT_PROFILE_UPDATED_EVENT,
        handleProfileUpdated,
      );
    };
  }, []);

  if (isSettingsWorkspace) {
    return (
      <div
        className="min-h-screen bg-[#f1f1f1] text-foreground"
        data-testid="tenant-settings-shell"
      >
        <TenantGlobalHeader
          authContext={authContext}
          copy={messages.shell.tenant.header}
          displayName={displayName}
        />
        <main className="min-w-0">{children}</main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-muted/30 text-foreground"
      data-testid="tenant-dashboard-shell"
    >
      <TenantGlobalHeader
        authContext={authContext}
        copy={messages.shell.tenant.header}
        displayName={displayName}
      />

      <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          className="flex flex-col border-b bg-sidebar px-3 py-4 text-sidebar-foreground lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r"
          data-testid="tenant-sidebar"
        >
          <nav
            aria-label="tenant sidebar"
            className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto pb-5"
          >
            {sidebarItems.map((item) => {
              const selfActive = isActivePath(pathname, item.href);
              const isProductsItem =
                item.href === webAdminRoutes.tenant.products;
              const isPointOfSaleItem =
                item.href === webAdminRoutes.tenant.pointOfSale.home;
              const visualActive =
                selfActive ||
                (isProductsItem && serviceActive) ||
                (isPointOfSaleItem && isPointOfSalePage);
              const IconComponent = getNavIcon(item.href);

              return (
                <div key={item.href}>
                  <Link
                    aria-current={selfActive ? "page" : undefined}
                    aria-expanded={
                      isProductsItem || isPointOfSaleItem
                        ? visualActive
                        : undefined
                    }
                    className={cn(
                      "group relative flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      visualActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                    href={item.href}
                  >
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity",
                        visualActive && "opacity-100",
                      )}
                    />
                    {IconComponent ? (
                      <Icon
                        aria-hidden
                        className={cn(
                          "text-muted-foreground transition-colors",
                          visualActive && "text-sidebar-accent-foreground",
                        )}
                        icon={IconComponent}
                        size={16}
                      />
                    ) : null}
                    <span className="truncate">{item.label}</span>
                  </Link>

                  {isProductsItem && visualActive ? (
                    <div className="ml-4 mt-1 border-l border-sidebar-border pl-2">
                      <Link
                        aria-current={serviceActive ? "page" : undefined}
                        className={cn(
                          "flex h-7 items-center gap-2 rounded-md px-2.5 text-xs font-medium transition-colors",
                          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          serviceActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-muted-foreground",
                        )}
                        href={webAdminRoutes.tenant.services}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 rounded-full bg-muted-foreground/50",
                            serviceActive && "bg-sidebar-accent-foreground",
                          )}
                        />
                        <span className="truncate">
                          {messages.tenant.services.title}
                        </span>
                      </Link>
                    </div>
                  ) : null}

                  {isPointOfSaleItem && visualActive ? (
                    <div className="ml-4 mt-1 border-l border-sidebar-border pl-2">
                      {pointOfSaleTabs.map((tab) => {
                        const tabActive =
                          tab.href === webAdminRoutes.tenant.pointOfSale.home
                            ? pathname === tab.href
                            : isActivePath(pathname, tab.href);

                        return (
                          <Link
                            aria-current={tabActive ? "page" : undefined}
                            className={cn(
                              "flex h-7 items-center gap-2 rounded-md px-2.5 text-xs font-medium transition-colors",
                              "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              tabActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-muted-foreground",
                            )}
                            href={tab.href}
                            key={tab.href}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "size-1.5 rounded-full bg-muted-foreground/50",
                                tabActive && "bg-sidebar-accent-foreground",
                              )}
                            />
                            <span className="truncate">{tab.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>

          <div className="border-t pt-3">
            <Link
              aria-current={settingsActive ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                settingsActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground",
              )}
              href={settingsHref}
            >
              {SettingsIcon ? (
                <Icon aria-hidden icon={SettingsIcon} size={16} />
              ) : null}
              <span className="truncate">
                {messages.tenant.settings.eyebrow}
              </span>
            </Link>
          </div>
        </aside>

        <main className="min-w-0 px-5 py-6 lg:px-8">
          {usesFlatPageLayout ? (
            children
          ) : (
            <Card className="rounded-lg">
              <CardContent className="p-0">{children}</CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}
