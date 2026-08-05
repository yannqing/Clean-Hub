"use client";

import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import { cn } from "@cleanhub/ui";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { posRoutes, posSidebarNavigation } from "@/config";
import { usePendingPrintJobCounts } from "@/features/hardware/components/pending-print-jobs";
import { OfflineSyncBadge } from "@/features/offline/components";

import { Icon } from "./icons";
import { PosGlobalHeader } from "./pos-global-header";

function isActivePath(pathname: string, href: string): boolean {
  if (href === posRoutes.workspace) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export type PosShellProfile = {
  name: string;
  role: string;
  initials: string;
};

type PosShellProps = {
  children: React.ReactNode;
  notificationUnreadCount?: number;
  profile?: PosShellProfile;
};

const FALLBACK_PROFILE: PosShellProfile = {
  name: "",
  role: "",
  initials: "?",
};

const ROLE_LABEL_KEYS: Record<string, TranslationKey> = {
  owner: "pos.role.owner",
  manager: "pos.role.manager",
  cashier: "pos.role.cashier",
};

function buildInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return FALLBACK_PROFILE.initials;
  }

  return [...trimmed][0] ?? FALLBACK_PROFILE.initials;
}

function localizeProfileName(
  name: string,
  roleLabel: string,
  locale: string,
): string {
  if (locale === "zh-CN") {
    return name;
  }

  const suffix = name.match(/\d+$/)?.[0];
  if (/收银员|店长|店主/.test(name)) {
    return suffix ? `${roleLabel} ${suffix}` : roleLabel;
  }

  return name;
}

function resolveActivePathname(
  pathname: string,
  searchParams: Pick<URLSearchParams, "get">,
): string {
  const entrySource = searchParams.get("from");
  const ticketEntrySource = searchParams.get("ticketFrom");

  if (
    entrySource === "intake" &&
    (pathname.startsWith("/customers/") || pathname.startsWith("/tickets/"))
  ) {
    return posRoutes.newIntake;
  }

  if (entrySource === "customer" && pathname.startsWith("/tickets/")) {
    return posRoutes.customers;
  }

  if (entrySource === "ticket" && pathname.startsWith("/orders/")) {
    if (ticketEntrySource === "intake") {
      return posRoutes.newIntake;
    }
    if (ticketEntrySource === "customer") {
      return posRoutes.customers;
    }
    return posRoutes.tickets;
  }

  return pathname;
}

export function PosShell({
  children,
  notificationUnreadCount = 0,
  profile,
}: PosShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activePathname = resolveActivePathname(pathname, searchParams);
  const { locale, t } = useTranslation();
  const [currentUnreadCount, setCurrentUnreadCount] = useState(
    notificationUnreadCount,
  );
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const resolvedProfile = profile ?? FALLBACK_PROFILE;
  const roleLabelKey = ROLE_LABEL_KEYS[resolvedProfile.role];
  const roleLabel = roleLabelKey ? t(roleLabelKey) : resolvedProfile.role;
  const profileName =
    localizeProfileName(resolvedProfile.name, roleLabel, locale) || roleLabel;
  const displayInitials =
    resolvedProfile.initials || buildInitials(profileName);
  const settingsActive = isActivePath(pathname, posRoutes.settings);
  const canReprint =
    resolvedProfile.role === "owner" || resolvedProfile.role === "manager";
  const { actionable: pendingPrintTaskCount, syncPending: syncingPrintTaskCount } =
    usePendingPrintJobCounts();
  const printTaskAttentionCount =
    pendingPrintTaskCount + syncingPrintTaskCount;
  const hasPrintTaskAttention =
    printTaskAttentionCount > 0;

  return (
    <div className="flex h-screen h-dvh min-h-0 flex-col overflow-hidden bg-muted/30 pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] text-foreground">
      <div className="relative z-50 shrink-0 bg-black pt-[env(safe-area-inset-top)]">
        <PosGlobalHeader
          canReprint={canReprint}
          displayInitials={displayInitials}
          notificationUnreadCount={currentUnreadCount}
          onOpenNavigation={() => setMobileNavigationOpen(true)}
          onUnreadCountChange={setCurrentUnreadCount}
          pendingPrintTaskCount={pendingPrintTaskCount}
          profileName={profileName}
          roleLabel={roleLabel}
          syncingPrintTaskCount={syncingPrintTaskCount}
        />
      </div>

      <div className="relative flex min-h-0 flex-1">
        {mobileNavigationOpen ? (
          <button
            aria-label={t("pos.shell.closeNavigation")}
            className="absolute inset-0 z-30 bg-black/35 backdrop-blur-[1px] lg:hidden"
            onClick={() => setMobileNavigationOpen(false)}
            type="button"
          />
        ) : null}

        <aside
          className={cn(
            "absolute inset-y-0 left-0 z-40 flex w-[240px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 text-sidebar-foreground shadow-xl transition-transform duration-200 lg:static lg:translate-x-0 lg:shadow-none",
            mobileNavigationOpen ? "translate-x-0" : "-translate-x-full",
          )}
          data-testid="pos-sidebar"
        >
          <div className="mb-3 flex items-center justify-between px-2 lg:hidden">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              CleanHub POS
            </span>
            <button
              aria-label={t("pos.shell.closeNavigation")}
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => setMobileNavigationOpen(false)}
              type="button"
            >
              <Icon className="h-[18px] w-[18px]" name="x" />
            </button>
          </div>

          <nav
            aria-label={t("common.mainNavigation")}
            className="pos-scrollbar grid min-h-0 flex-1 content-start gap-1 overflow-y-auto pb-5"
          >
            {posSidebarNavigation.map((item) => {
              const active = isActivePath(activePathname, item.href);
              const label = t(item.labelKey);
              const showNotificationIndicator =
                (currentUnreadCount > 0 || hasPrintTaskAttention) &&
                item.href === posRoutes.notifications;

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  aria-label={
                    showNotificationIndicator
                      ? `${
                          currentUnreadCount > 0
                            ? t("pos.shell.unreadMessages", {
                                count: currentUnreadCount,
                              })
                            : label
                        }${
                          hasPrintTaskAttention
                            ? `，${printTaskAttentionCount} 个终端打印事项`
                            : ""
                        }`
                      : label
                  }
                  className={cn(
                    "group relative flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-muted-foreground",
                  )}
                  href={item.href}
                  key={item.href}
                  onClick={() => setMobileNavigationOpen(false)}
                >
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity",
                      active && "opacity-100",
                    )}
                  />
                  <Icon
                    className={cn(
                      "h-4 w-4 text-muted-foreground transition-colors",
                      active && "text-sidebar-accent-foreground",
                    )}
                    name={item.icon}
                  />
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                  {showNotificationIndicator ? (
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        currentUnreadCount > 0 ? "bg-red-500" : "bg-amber-500",
                      )}
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-sidebar-border pt-3">
            <OfflineSyncBadge className="mb-2 w-full justify-start text-xs" />
            <Link
              aria-current={settingsActive ? "page" : undefined}
              className={cn(
                "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                settingsActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground",
              )}
              href={posRoutes.settings}
              onClick={() => setMobileNavigationOpen(false)}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity",
                  settingsActive && "opacity-100",
                )}
              />
              <Icon
                className={cn(
                  "h-4 w-4 text-muted-foreground",
                  settingsActive && "text-sidebar-accent-foreground",
                )}
                name="settings"
              />
              <span className="truncate">{t("pos.nav.settings")}</span>
            </Link>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="pos-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
