"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@cleanhub/ui";
import Link from "next/link";
import { useState } from "react";

import {
  posMobileOverflowNavigation,
  posMobilePrimaryNavigation,
  posRoutes,
} from "@/config";
import { OfflineSyncBadge } from "@/features/offline/components";
import { LogoutButton } from "@/features/auth/components";

import { Icon } from "./icons";

type PosMobileNavigationProps = {
  activePathname: string;
  branchName: string;
  hasNotificationAttention: boolean;
  profileName: string;
  settingsActive: boolean;
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === posRoutes.workspace) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PosMobileNavigation({
  activePathname,
  branchName,
  hasNotificationAttention,
  profileName,
  settingsActive,
}: PosMobileNavigationProps) {
  const { t } = useTranslation();
  const [moreOpen, setMoreOpen] = useState(false);
  const overflowActive =
    settingsActive ||
    posMobileOverflowNavigation.some((item) =>
      isActivePath(activePathname, item.href),
    );

  return (
    <nav
      aria-label={t("common.mainNavigation")}
      className="relative z-40 grid shrink-0 grid-cols-5 border-t bg-background/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
      data-testid="pos-mobile-navigation"
    >
      {posMobilePrimaryNavigation.map((item) => {
        const active = isActivePath(activePathname, item.href);
        const label = t(item.labelKey);

        return (
          <Link
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={cn(
              "relative flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              active
                ? "text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            href={item.href}
            key={item.href}
            onClick={() => setMoreOpen(false)}
          >
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-xl transition-colors",
                active && "bg-primary/10",
              )}
            >
              <Icon className="size-[19px]" name={item.icon} />
            </span>
            <span className="max-w-full truncate leading-none">{label}</span>
          </Link>
        );
      })}

      <Popover onOpenChange={setMoreOpen} open={moreOpen}>
        <PopoverTrigger asChild>
          <button
            aria-expanded={moreOpen}
            aria-label={t("pos.nav.more")}
            className={cn(
              "relative flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              moreOpen || overflowActive
                ? "text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
            type="button"
          >
            <span
              className={cn(
                "relative flex size-8 items-center justify-center rounded-xl transition-colors",
                (moreOpen || overflowActive) && "bg-primary/10",
              )}
            >
              <Icon className="size-5" name="ellipsis" />
              {hasNotificationAttention ? (
                <span className="absolute right-0 top-0 size-2 rounded-full bg-amber-500 ring-2 ring-background" />
              ) : null}
            </span>
            <span className="max-w-full truncate leading-none">
              {t("pos.nav.more")}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[calc(100vw-1.5rem)] max-w-sm overflow-hidden rounded-2xl p-0 shadow-2xl"
          side="top"
          sideOffset={12}
        >
          <div className="flex items-center gap-4 px-5 pb-3 pt-5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-foreground">
                {profileName}
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {branchName}
              </p>
            </div>
            <LogoutButton
              aria-label={t("pos.shell.lockScreen")}
              className="flex size-10 shrink-0 items-center justify-center text-foreground transition-colors hover:text-muted-foreground disabled:cursor-wait disabled:opacity-50"
              failureMessage={t("pos.shell.lockFailed")}
              successMessage={t("pos.shell.lockSuccess")}
              title={t("pos.shell.lockScreen")}
            >
              <Icon className="size-5" name="lock" />
            </LogoutButton>
          </div>
          <div className="pos-scrollbar flex max-h-[calc(100dvh-13.5rem)] flex-col overflow-y-auto px-5 py-1">
            {posMobileOverflowNavigation.map((item) => {
              const active = isActivePath(activePathname, item.href);
              const label = t(item.labelKey);
              const notificationItem = item.href === posRoutes.notifications;

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-14 min-w-0 items-center gap-4 py-3 text-base transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "font-semibold text-foreground"
                      : "font-medium text-foreground hover:text-muted-foreground",
                  )}
                  href={item.href}
                  key={item.href}
                  onClick={() => setMoreOpen(false)}
                >
                  <span className="min-w-0 flex-1 truncate text-left">
                    {label}
                  </span>
                  {notificationItem && hasNotificationAttention ? (
                    <span className="size-2 shrink-0 rounded-full bg-amber-500" />
                  ) : null}
                  <Icon
                    className="size-5 shrink-0 text-foreground"
                    name="chevron-right"
                  />
                </Link>
              );
            })}
            <Link
              aria-current={settingsActive ? "page" : undefined}
              className={cn(
                "flex min-h-14 min-w-0 items-center gap-4 py-3 text-base transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                settingsActive
                  ? "font-semibold text-foreground"
                  : "font-medium text-foreground hover:text-muted-foreground",
              )}
              href={posRoutes.settings}
              onClick={() => setMoreOpen(false)}
            >
              <span className="min-w-0 flex-1 truncate text-left">
                {t("pos.nav.settings")}
              </span>
              <Icon
                className="size-5 shrink-0 text-foreground"
                name="chevron-right"
              />
            </Link>
          </div>
          <div className="px-5 pb-3 pt-1">
            <OfflineSyncBadge className="w-full justify-start rounded-none bg-transparent px-0 text-xs text-muted-foreground" />
          </div>
        </PopoverContent>
      </Popover>
    </nav>
  );
}
