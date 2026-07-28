"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import { cn } from "@cleanhub/ui";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { LanguageSwitcher } from "@/components/i18n";
import { posRoutes } from "@/config";
import { LogoutButton } from "@/features/auth/components";
import { GlobalSearchBox } from "@/features/global-search";
import { HeaderNotificationsMenu } from "@/features/notifications/components";
import { OfflineSyncBadge } from "@/features/offline/components";

import { Icon } from "./icons";

type PosGlobalHeaderProps = {
  displayInitials: string;
  notificationUnreadCount: number;
  onOpenNavigation: () => void;
  onUnreadCountChange: (count: number) => void;
  profileName: string;
  roleLabel: string;
};

export function PosGlobalHeader({
  displayInitials,
  notificationUnreadCount,
  onOpenNavigation,
  onUnreadCountChange,
  profileName,
  roleLabel,
}: PosGlobalHeaderProps) {
  const { t } = useTranslation();
  const accountRootRef = useRef<HTMLDivElement>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  useEffect(() => {
    if (!accountOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!accountRootRef.current?.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountOpen]);

  return (
    <header
      className="relative z-50 h-16 shrink-0 border-b border-white/10 bg-black text-white"
      data-pos-i18n-managed="true"
      data-testid="pos-global-header"
    >
      <div className="flex h-full items-center gap-2 px-3 sm:px-4 lg:gap-4 lg:px-0">
        <div className="flex shrink-0 items-center gap-2 lg:w-56 lg:px-3">
          <button
            aria-label={t("pos.shell.openNavigation")}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/15 hover:text-white lg:hidden"
            onClick={onOpenNavigation}
            type="button"
          >
            <Icon className="h-[18px] w-[18px]" name="menu" />
          </button>

          <Link
            aria-label="CleanHub POS"
            className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            href={posRoutes.workspace}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-extrabold tracking-tight text-black">
              CH
            </span>
            <span className="hidden min-w-0 sm:block">
              <span className="block truncate text-sm font-semibold tracking-tight">
                CleanHub
              </span>
              <span className="block text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">
                POS
              </span>
            </span>
          </Link>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center px-3 md:flex lg:px-5">
          <GlobalSearchBox variant="dark" />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:pr-4">
          <button
            aria-label={t("pos.shell.openSearch")}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/80 transition hover:bg-white/15 hover:text-white md:hidden"
            onClick={() => setMobileSearchOpen(true)}
            type="button"
          >
            <Icon className="h-[18px] w-[18px]" name="search" />
          </button>

          <OfflineSyncBadge
            className="hidden sm:flex"
            variant="dark"
          />
          <LanguageSwitcher
            className="hidden sm:block"
            compact
            variant="dark"
          />
          <HeaderNotificationsMenu
            onUnreadCountChange={onUnreadCountChange}
            unreadCount={notificationUnreadCount}
            variant="dark"
          />

          <div className="relative" ref={accountRootRef}>
            <button
              aria-expanded={accountOpen}
              aria-label={t("pos.shell.accountMenu")}
              className={cn(
                "flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/10 p-1 pr-1 text-left text-white/85 transition hover:bg-white/15 hover:text-white",
                "2xl:min-w-40 2xl:pr-2.5",
              )}
              onClick={() => setAccountOpen((current) => !current)}
              type="button"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white text-xs font-bold text-black">
                {displayInitials}
              </span>
              <span className="hidden min-w-0 flex-1 2xl:block">
                <span className="block max-w-28 truncate text-xs font-semibold">
                  {profileName}
                </span>
                <span className="mt-0.5 block truncate text-[10px] text-white/45">
                  {roleLabel}
                </span>
              </span>
              <Icon
                className={cn(
                  "hidden h-3.5 w-3.5 text-white/40 transition 2xl:block",
                  accountOpen && "rotate-180",
                )}
                name="chevron-down"
              />
            </button>

            {accountOpen ? (
              <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(260px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.2)]">
                <div className="border-b border-slate-100 px-3 py-2.5">
                  <p className="truncate text-sm font-semibold">
                    {profileName}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-500">
                    {roleLabel}
                  </p>
                </div>
                <div className="py-1.5">
                  <Link
                    className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                    href={posRoutes.settings}
                    onClick={() => setAccountOpen(false)}
                  >
                    <Icon className="h-4 w-4 text-slate-400" name="settings" />
                    {t("pos.nav.settings")}
                  </Link>
                  <LogoutButton
                    aria-label={t("pos.shell.logout")}
                    className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 disabled:opacity-60"
                  >
                    <Icon className="h-4 w-4 text-slate-400" name="log-out" />
                    {t("pos.shell.logout")}
                  </LogoutButton>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {mobileSearchOpen ? (
        <div className="absolute inset-0 z-[60] flex items-center gap-2 bg-black px-3 md:hidden">
          <GlobalSearchBox className="max-w-none flex-1" variant="dark" />
          <button
            aria-label={t("pos.shell.closeSearch")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/80"
            onClick={() => setMobileSearchOpen(false)}
            type="button"
          >
            <Icon className="h-[18px] w-[18px]" name="x" />
          </button>
        </div>
      ) : null}
    </header>
  );
}
