"use client";

import type { AuthContext } from "@cleanhub/api-client";
import {
  Icon,
  Popover,
  PopoverContent,
  PopoverTrigger,
  toast,
  cn,
} from "@cleanhub/ui";
import { ChevronDown, Settings, UserRound } from "lucide-react";
import Link from "next/link";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { webAdminRoutes } from "@/config/routes";
import { LogoutButton } from "@/features/auth/components";
import { dispatchSaasProfileUpdated } from "@/features/saas/profile";
import { updateSaasProfileAction } from "@/features/saas/profile/actions";
import { isWebAdminLocale, useWebAdminLocale, type WebAdminLocale } from "@/i18n";

import type { SaasHeaderCopy } from "../types";

type SaasHeaderAccountMenuProps = {
  accountName: string;
  authContext: AuthContext | null;
  copy: SaasHeaderCopy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function getRoleLabel(
  authContext: AuthContext | null,
  messages: ReturnType<typeof useWebAdminLocale>["messages"],
): string {
  if (authContext?.role === "super_admin") {
    return messages.saas.common.roleLabels.superAdmin;
  }

  if (authContext?.role === "support") {
    return messages.saas.common.roleLabels.support;
  }

  return messages.saas.common.roleLabels.unassigned;
}

export function SaasHeaderAccountMenu({
  accountName,
  authContext,
  copy,
  open,
  onOpenChange,
}: SaasHeaderAccountMenuProps) {
  const { locale, messages } = useWebAdminLocale();
  const roleLabel = getRoleLabel(authContext, messages);

  async function saveLanguage(next: WebAdminLocale) {
    try {
      const updated = await updateSaasProfileAction({ language: next });
      dispatchSaasProfileUpdated({
        displayName: updated.displayName,
        language: isWebAdminLocale(updated.language) ? updated.language : next,
      });
    } catch (error) {
      toast.error(locale === "zh-CN"
        ? "语言保存失败，请重试。"
        : locale === "fr"
          ? "Impossible d'enregistrer la langue. Réessayez."
          : "Could not save the language. Try again.");
      throw error;
    }
  }

  return (
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          aria-label={`${copy.accountLabel}: ${accountName}`}
          className={cn(
            "flex min-w-0 items-center gap-2 border-l border-white/15 pl-2 text-left transition sm:pl-3",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
          )}
          data-testid="saas-header-user"
          title={copy.account.menuLabel}
          type="button"
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors",
              "hover:bg-white/15",
              open && "bg-white/20 text-white",
            )}
          >
            <Icon aria-hidden icon={UserRound} />
          </span>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-36 truncate text-sm font-medium text-white">
              {accountName}
            </span>
            <span className="block max-w-36 truncate text-[11px] text-white/55">
              {roleLabel}
            </span>
          </span>
          <Icon
            aria-hidden
            className={cn(
              "hidden shrink-0 text-white/55 transition-transform sm:block",
              open && "rotate-180",
            )}
            icon={ChevronDown}
            size={14}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[310px] overflow-hidden rounded-xl p-0 shadow-xl"
        sideOffset={10}
      >
        <div className="border-b bg-muted/35 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <Icon aria-hidden icon={UserRound} size={18} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{accountName}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {roleLabel}
              </p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted-foreground">{copy.account.roleLabel}</dt>
            <dd className="truncate text-right font-medium">{roleLabel}</dd>
          </dl>
        </div>

        <nav className="grid gap-1 p-2">
          <Link
            className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={webAdminRoutes.saas.profile}
            onClick={() => onOpenChange(false)}
          >
            <Icon aria-hidden icon={UserRound} size={16} />
            {copy.account.profile}
          </Link>
          <Link
            className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={webAdminRoutes.saas.config.platformSettings}
            onClick={() => onOpenChange(false)}
          >
            <Icon aria-hidden icon={Settings} size={16} />
            {copy.account.settings}
          </Link>
        </nav>

        <div className="flex items-center gap-2 border-t px-3 py-3">
          <LanguageSwitcher className="min-w-0 flex-1" onLocaleChange={saveLanguage} />
          <ThemeToggle />
        </div>

        <div className="border-t p-2">
          <LogoutButton
            className="h-9 w-full justify-start px-2.5 text-sm font-medium"
            signOutLabel={messages.common.signOut}
            signingOutLabel={messages.common.signingOut}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
