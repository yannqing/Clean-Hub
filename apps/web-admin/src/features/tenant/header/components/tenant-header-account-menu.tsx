"use client";

import type { AuthContext } from "@cleanhub/api-client";
import {
  Icon,
  Popover,
  PopoverContent,
  PopoverTrigger,
  cn,
} from "@cleanhub/ui";
import { ChevronDown, LoaderCircle, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

import { webAdminRoutes } from "@/config/routes";
import { LogoutButton } from "@/features/auth/components";
import { useWebAdminLocale } from "@/i18n";

import type { TenantHeaderCopy } from "../types";

type TenantHeaderAccountMenuProps = {
  accountName: string;
  authContext: AuthContext | null;
  copy: TenantHeaderCopy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function getAccountInitials(accountName: string): string {
  const parts = accountName.trim().split(/\s+/).filter(Boolean);

  if (parts.length > 1) {
    return `${Array.from(parts[0] ?? "")[0] ?? ""}${
      Array.from(parts.at(-1) ?? "")[0] ?? ""
    }`.toUpperCase();
  }

  return Array.from(parts[0] ?? "CH")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function TenantHeaderAccountMenu({
  accountName,
  authContext,
  copy,
  open,
  onOpenChange,
}: TenantHeaderAccountMenuProps) {
  const { messages } = useWebAdminLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isProfilePending, startProfileTransition] = useTransition();
  const roleLabel = authContext
    ? messages.tenant.settings.navigation.roleLabels[authContext.role]
    : messages.tenant.settings.navigation.accountFallback;
  const initials = getAccountInitials(accountName);
  const profileHref = webAdminRoutes.tenant.profile;

  useEffect(() => {
    router.prefetch(profileHref);
  }, [profileHref, router]);

  function handleProfileClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    onOpenChange(false);

    if (pathname === profileHref) {
      return;
    }

    event.preventDefault();
    startProfileTransition(() => {
      router.push(profileHref);
    });
  }

  return (
    <>
      <Popover onOpenChange={onOpenChange} open={open}>
        <PopoverTrigger asChild>
          <button
            aria-expanded={open}
            aria-label={`${copy.accountLabel}: ${accountName}`}
            className={cn(
              "flex h-10 min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] p-1 pr-2 text-left transition-colors",
              "hover:border-white/15 hover:bg-white/10",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
              open && "border-white/20 bg-white/15",
            )}
            data-testid="tenant-header-user"
            title={copy.account.menuLabel}
            type="button"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-xs font-semibold text-black">
              {initials}
            </span>
            <span className="hidden max-w-36 truncate text-sm font-medium text-white sm:block">
              {accountName}
            </span>
            <Icon
              aria-hidden
              className={cn(
                "hidden shrink-0 text-white/60 transition-transform sm:block",
                open && "rotate-180",
              )}
              icon={ChevronDown}
              size={14}
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-[288px] overflow-hidden rounded-xl p-1.5 shadow-2xl"
          sideOffset={8}
        >
          <Link
            aria-disabled={isProfilePending}
            aria-label={copy.account.profile}
            className={cn(
              "flex items-center gap-3 rounded-lg bg-muted/65 px-3 py-2.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isProfilePending && "pointer-events-none opacity-60",
            )}
            href={profileHref}
            onClick={handleProfileClick}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-semibold text-background">
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {accountName}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {roleLabel}
              </span>
            </span>
            <Icon
              aria-hidden
              className="shrink-0 text-muted-foreground"
              icon={UserRound}
              size={16}
            />
          </Link>

          <div className="mt-1.5 border-t pt-1.5">
            <LogoutButton
              className="h-10 w-full justify-start rounded-lg px-3 text-sm font-normal"
              leadingIcon={<Icon aria-hidden icon={LogOut} size={16} />}
              signOutLabel={messages.common.signOut}
              signingOutLabel={messages.common.signingOut}
            />
          </div>
        </PopoverContent>
      </Popover>

      {isProfilePending ? (
        <div
          aria-busy="true"
          aria-live="polite"
          className="fixed inset-x-0 bottom-0 top-16 z-40 grid place-items-center bg-background/80 text-foreground backdrop-blur-[1px]"
          role="status"
        >
          <div className="flex items-center gap-2.5 rounded-full border bg-background px-4 py-2.5 text-sm font-medium shadow-lg">
            <Icon
              aria-hidden
              className="animate-spin text-muted-foreground"
              icon={LoaderCircle}
              size={18}
            />
            {copy.account.loadingProfile}
          </div>
        </div>
      ) : null}
    </>
  );
}
