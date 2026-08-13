"use client";

import type { AuthContext } from "@cleanhub/api-client";
import { Icon, Input } from "@cleanhub/ui";
import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { CleanHubBrandMark } from "@/components/branding";
import {
  SaasHeaderAccountMenu,
  SaasHeaderAssistant,
  type SaasHeaderCopy,
  type SaasHeaderPanel,
} from "@/features/saas/header";
import { TodoCenterBell } from "@/features/saas/todo-center/components";

type SaasGlobalHeaderProps = {
  authContext: AuthContext | null;
  copy: SaasHeaderCopy;
  displayName: string;
};

export function SaasGlobalHeader({
  authContext,
  copy,
  displayName,
}: SaasGlobalHeaderProps) {
  const accountName = authContext?.displayName.trim() || displayName;
  const [activePanel, setActivePanel] = useState<SaasHeaderPanel | null>(null);

  function handlePanelChange(panel: SaasHeaderPanel, open: boolean) {
    setActivePanel(open ? panel : null);
  }

  return (
    <header
      className="sticky top-0 z-50 h-16 border-b border-white/10 bg-black text-white"
      data-testid="saas-global-header"
    >
      <div className="flex h-full items-center px-4 sm:px-5 lg:px-0">
        <div className="flex shrink-0 items-center lg:w-[240px] lg:px-3">
          <Link
            aria-label="CleanHub"
            className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            href={webAdminRoutes.saas.home}
          >
            <CleanHubBrandMark className="size-10 rounded-lg" priority />
            <span className="hidden text-sm font-semibold tracking-tight sm:block">
              CleanHub
            </span>
          </Link>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center px-5 md:flex">
          <div className="relative w-full max-w-xl">
            <label className="sr-only" htmlFor="saas-global-search">
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
              data-testid="saas-header-search"
              id="saas-global-search"
              placeholder={copy.searchPlaceholder}
              type="search"
            />
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 pr-0 sm:gap-2 lg:pr-5">
          <SaasHeaderAssistant
            copy={copy}
            onOpenChange={(open) => handlePanelChange("assistant", open)}
            open={activePanel === "assistant"}
          />
          <TodoCenterBell className="rounded-xl text-white/75 hover:bg-white/10 hover:text-white focus-visible:ring-white/60" />
          <SaasHeaderAccountMenu
            accountName={accountName}
            authContext={authContext}
            copy={copy}
            onOpenChange={(open) => handlePanelChange("account", open)}
            open={activePanel === "account"}
          />
        </div>
      </div>
    </header>
  );
}
