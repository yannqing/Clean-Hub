"use client";

import type { AuthContext } from "@cleanhub/api-client";
import { Icon, Input } from "@cleanhub/ui";
import { Bot, MessageSquare, Search, UserRound } from "lucide-react";
import Link from "next/link";

import { webAdminRoutes } from "@/config/routes";
import type { WebAdminMessages } from "@/i18n/messages-types";

type TenantHeaderCopy = WebAdminMessages["shell"]["tenant"]["header"];

type TenantGlobalHeaderProps = {
  authContext: AuthContext | null;
  copy: TenantHeaderCopy;
  displayName: string;
};

export function TenantGlobalHeader({
  authContext,
  copy,
  displayName,
}: TenantGlobalHeaderProps) {
  const accountName = authContext?.displayName.trim() || displayName;

  return (
    <header
      className="sticky top-0 z-50 h-16 border-b border-white/10 bg-black text-white"
      data-testid="tenant-global-header"
    >
      <div className="flex h-full items-center px-4 sm:px-5 lg:px-0">
        <div className="flex shrink-0 items-center lg:w-[240px] lg:px-3">
          <Link
            aria-label="CleanHub"
            className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            href={webAdminRoutes.tenant.home}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-semibold text-black">
              CH
            </span>
            <span className="hidden text-sm font-semibold tracking-tight sm:block">
              CleanHub
            </span>
          </Link>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center px-5 md:flex">
          <div className="relative w-full max-w-xl">
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
              autoComplete="off"
              className="h-10 rounded-lg border-white/15 bg-white/10 pl-10 text-white shadow-none placeholder:text-white/45 hover:bg-white/[0.12] focus-visible:border-white/30 focus-visible:ring-white/20 dark:bg-white/10"
              data-testid="tenant-header-search"
              id="tenant-global-search"
              placeholder={copy.searchPlaceholder}
              type="search"
            />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 pr-0 sm:gap-2 lg:pr-5">
          <span
            aria-label={copy.assistantLabel}
            className="flex size-9 items-center justify-center rounded-full border border-white/15 text-white/75"
            data-testid="tenant-header-assistant"
            role="img"
            title={copy.assistantLabel}
          >
            <Icon aria-hidden icon={Bot} />
          </span>
          <span
            aria-label={copy.messagesLabel}
            className="flex size-9 items-center justify-center rounded-full border border-white/15 text-white/75"
            data-testid="tenant-header-messages"
            role="img"
            title={copy.messagesLabel}
          >
            <Icon aria-hidden icon={MessageSquare} />
          </span>
          <div
            aria-label={`${copy.accountLabel}: ${accountName}`}
            className="flex min-w-0 items-center gap-2 border-l border-white/15 pl-2 sm:pl-3"
            data-testid="tenant-header-user"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85">
              <Icon aria-hidden icon={UserRound} />
            </span>
            <span className="hidden max-w-40 truncate text-sm font-medium text-white sm:block">
              {accountName}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
