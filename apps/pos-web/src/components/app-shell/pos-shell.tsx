"use client";

import { cn } from "@cleanhub/ui";
import type { TranslationKey } from "@cleanhub/i18n";
import { useTranslation } from "@cleanhub/i18n/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

import { LogoutButton } from "@/features/auth/components";
import { GlobalSearchBox } from "@/features/global-search";
import { HeaderNotificationsMenu } from "@/features/notifications/components";
import { LanguageSwitcher } from "@/components/i18n";
import {
  posRoutes,
  posShellCopy,
  posSidebarNavigation,
} from "@/config";

import { Icon } from "./icons";

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
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
  const hasUnreadNotifications = currentUnreadCount > 0;
  const resolvedProfile: PosShellProfile = profile
    ? {
        name: profile.name,
        role: profile.role,
        initials: profile.initials || buildInitials(profile.name),
      }
    : FALLBACK_PROFILE;
  const roleLabelKey = ROLE_LABEL_KEYS[resolvedProfile.role];
  const roleLabel = roleLabelKey ? t(roleLabelKey) : resolvedProfile.role;
  const profileName = localizeProfileName(
    resolvedProfile.name,
    roleLabel,
    locale,
  );
  const displayInitials =
    locale === "zh-CN"
      ? resolvedProfile.initials
      : (roleLabel.trim()[0]?.toUpperCase() ?? resolvedProfile.initials);
  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F9FC] text-slate-900">
      <aside
        className="flex w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white"
        data-pos-i18n-managed="true"
      >
        <div className="border-b border-slate-100 px-5 py-5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="CleanHub mark"
              className="h-11 w-11 rounded-xl object-cover"
              src="/cleanhub-logo-mark.jpg"
            />
            <div>
              <div className="text-lg font-extrabold tracking-tight">
                <span className="text-slate-950">Clean</span>
                <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                  Hub
                </span>
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                {t(posShellCopy.brandSuffixKey)}
              </div>
            </div>
          </div>

          <Link
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700"
            href={posRoutes.newIntake}
          >
            <Icon className="h-4 w-4" name="user-plus" />
            {t("pos.shell.create")}
          </Link>
        </div>

        <nav className="pos-scrollbar flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          <div className="space-y-6">
            {posSidebarNavigation.map((section) => (
              <div key={section.titleKey}>
                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  {t(section.titleKey)}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const active = isActivePath(activePathname, item.href);
                    const label = t(item.labelKey);
                    const showUnreadIndicator =
                      hasUnreadNotifications &&
                      item.href === posRoutes.notifications;

                    return (
                      <Link
                        aria-current={active ? "page" : undefined}
                        aria-label={
                          showUnreadIndicator
                            ? t("pos.shell.unreadMessages", {
                                count: currentUnreadCount,
                              })
                            : undefined
                        }
                        className={cn(
                          "relative flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition",
                          active
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                        )}
                        href={item.href}
                        key={item.labelKey}
                      >
                        {active ? (
                          <span className="absolute left-0 h-5 w-1 rounded-r-full bg-blue-600" />
                        ) : null}
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-md",
                            active
                              ? "bg-white text-blue-700 shadow-sm"
                              : "text-slate-400",
                          )}
                        >
                          <Icon className="h-4 w-4" name={item.icon} />
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {label}
                        </span>
                        {showUnreadIndicator ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" />
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 via-blue-500 to-violet-500 text-xs font-bold text-white">
              {displayInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-slate-900">
                {profileName}
              </div>
              <div className="text-xs font-medium text-slate-500">
                {roleLabel}
              </div>
            </div>
            <LogoutButton
              aria-label={t("pos.shell.logout")}
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700"
            >
              <Icon className="h-4 w-4" name="lock" />
            </LogoutButton>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex h-[68px] items-center gap-4 border-b border-slate-200 bg-white px-6"
          data-pos-i18n-managed="true"
        >
          <GlobalSearchBox />

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 lg:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {t("pos.shell.synced")}
            </div>
            <LanguageSwitcher />
            <LogoutButton
              aria-label={t("pos.shell.lockScreen")}
              className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              signOutLabel={t("pos.shell.lockScreen")}
            >
              <Icon className="h-4 w-4 text-slate-500" name="lock" />
              {t("pos.shell.lockScreen")}
            </LogoutButton>
            <HeaderNotificationsMenu
              onUnreadCountChange={setCurrentUnreadCount}
              unreadCount={currentUnreadCount}
            />
          </div>
        </header>

        <div className="pos-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
          {children}
        </div>
      </main>
    </div>
  );
}
