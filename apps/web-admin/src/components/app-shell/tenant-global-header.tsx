"use client";

import type { AuthContext } from "@cleanhub/api-client";
import Link from "next/link";
import { useState } from "react";

import { webAdminRoutes } from "@/config/routes";
import { CleanHubBrandMark } from "@/components/branding";
import {
  TenantHeaderAccountMenu,
  TenantHeaderAssistant,
  TenantHeaderGlobalSearch,
  TenantHeaderMessages,
  type TenantHeaderCopy,
  type TenantHeaderPanel,
} from "@/features/tenant/header";

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
  const [activePanel, setActivePanel] = useState<TenantHeaderPanel | null>(
    null,
  );

  function handlePanelChange(panel: TenantHeaderPanel, open: boolean) {
    setActivePanel(open ? panel : null);
  }

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
            <CleanHubBrandMark className="size-10 rounded-lg" priority />
            <span className="hidden text-sm font-semibold tracking-tight sm:block">
              CleanHub
            </span>
          </Link>
        </div>

        <div className="hidden min-w-0 flex-1 justify-center px-5 md:flex">
          <TenantHeaderGlobalSearch copy={copy} />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 pr-0 sm:gap-2 lg:pr-5">
          <TenantHeaderAssistant
            authContext={authContext}
            copy={copy}
            onOpenChange={(open) => handlePanelChange("assistant", open)}
            open={activePanel === "assistant"}
          />
          <TenantHeaderMessages
            copy={copy}
            onOpenChange={(open) => handlePanelChange("messages", open)}
            open={activePanel === "messages"}
          />
          <TenantHeaderAccountMenu
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
