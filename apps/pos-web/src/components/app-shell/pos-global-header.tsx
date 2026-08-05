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

import { Icon } from "./icons";

type HeaderPanel = "notifications" | "account";

type PosGlobalHeaderProps = {
  canReprint: boolean;
  displayInitials: string;
  notificationUnreadCount: number;
  onOpenNavigation: () => void;
  onUnreadCountChange: (count: number) => void;
  pendingPrintTaskCount: number;
  profileName: string;
  roleLabel: string;
  syncingPrintTaskCount: number;
};

export function PosGlobalHeader({
  canReprint,
  displayInitials,
  notificationUnreadCount,
  onOpenNavigation,
  onUnreadCountChange,
  pendingPrintTaskCount,
  profileName,
  roleLabel,
  syncingPrintTaskCount,
}: PosGlobalHeaderProps) {
  const { t } = useTranslation();
  const accountRootRef = useRef<HTMLDivElement>(null);
  const [activePanel, setActivePanel] = useState<HeaderPanel | null>(null);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const accountOpen = activePanel === "account";

  useEffect(() => {
    if (!accountOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!accountRootRef.current?.contains(event.target as Node)) {
        setActivePanel(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActivePanel(null);
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
        <div className="flex shrink-0 items-center gap-2 lg:w-[240px] lg:px-3">
          <button
            aria-label={t("pos.shell.openNavigation")}
            className="flex size-9 items-center justify-center rounded-xl text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 lg:hidden"
            onClick={() => {
              setActivePanel(null);
              setMobileSearchOpen(false);
              onOpenNavigation();
            }}
            type="button"
          >
            <Icon className="h-[18px] w-[18px]" name="menu" />
          </button>

          <Link
            aria-label="CleanHub POS"
            className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            href={posRoutes.workspace}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-semibold tracking-tight text-black">
              CH
            </span>
            <span className="hidden min-w-0 items-center gap-2 sm:flex">
              <span className="truncate text-sm font-semibold tracking-tight">
                CleanHub
              </span>
              <span className="rounded-full border border-white/15 bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/65">
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
            className="flex size-9 items-center justify-center rounded-xl text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 md:hidden"
            onClick={() => {
              setActivePanel(null);
              setMobileSearchOpen(true);
            }}
            type="button"
          >
            <Icon className="h-[18px] w-[18px]" name="search" />
          </button>

          <LogoutButton
            aria-label={t("pos.shell.lockScreen")}
            className="hidden size-9 items-center justify-center rounded-xl text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-wait disabled:opacity-50 sm:flex"
            failureMessage={t("pos.shell.lockFailed")}
            successMessage={t("pos.shell.lockSuccess")}
            title={t("pos.shell.lockScreen")}
          >
            <Icon className="h-4 w-4" name="lock" />
          </LogoutButton>
          <HeaderNotificationsMenu
            canReprint={canReprint}
            onOpenChange={(open) =>
              setActivePanel(open ? "notifications" : null)
            }
            onUnreadCountChange={onUnreadCountChange}
            open={activePanel === "notifications"}
            pendingPrintTaskCount={pendingPrintTaskCount}
            syncingPrintTaskCount={syncingPrintTaskCount}
            unreadCount={notificationUnreadCount}
          />

          <div className="relative z-50" ref={accountRootRef}>
            <button
              aria-expanded={accountOpen}
              aria-label={t("pos.shell.accountMenu")}
              className={cn(
                "flex min-w-0 items-center gap-2 border-l border-white/15 pl-2 text-left transition sm:pl-3",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
              )}
              onClick={() => setActivePanel(accountOpen ? null : "account")}
              type="button"
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/85 transition-colors hover:bg-white/15",
                  accountOpen && "bg-white/20 text-white",
                )}
              >
                {displayInitials}
              </span>
              <span className="hidden min-w-0 lg:block">
                <span className="block max-w-36 truncate text-sm font-medium text-white">
                  {profileName}
                </span>
                <span className="block max-w-36 truncate text-[11px] text-white/55">
                  {roleLabel}
                </span>
              </span>
              <Icon
                className={cn(
                  "hidden h-3.5 w-3.5 shrink-0 text-white/55 transition-transform lg:block",
                  accountOpen && "rotate-180",
                )}
                name="chevron-down"
              />
            </button>

            {accountOpen ? (
              <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(310px,calc(100vw-1rem))] rounded-xl border border-border bg-background text-foreground shadow-xl">
                <div className="rounded-t-xl border-b bg-muted/35 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-bold text-background">
                      {displayInitials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {profileName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {roleLabel}
                      </p>
                    </div>
                  </div>
                </div>
                <nav className="grid gap-1 p-2">
                  <Link
                    className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    href={posRoutes.settings}
                    onClick={() => setActivePanel(null)}
                  >
                    <Icon
                      className="h-4 w-4 text-muted-foreground"
                      name="settings"
                    />
                    {t("pos.nav.settings")}
                  </Link>
                </nav>
                <div className="border-t px-3 py-3">
                  <LanguageSwitcher fullWidth />
                </div>
                <div className="rounded-b-xl border-t p-2">
                  <LogoutButton
                    aria-label={t("pos.shell.logout")}
                    className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
                  >
                    <Icon
                      className="h-4 w-4 text-muted-foreground"
                      name="log-out"
                    />
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
            className="flex size-9 shrink-0 items-center justify-center rounded-xl text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
