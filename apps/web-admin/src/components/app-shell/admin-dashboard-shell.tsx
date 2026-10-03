"use client";

import type { AuthContext } from "@cleanhub/api-client";
import { isSaasAdminRole } from "@cleanhub/domain";
import { Icon, cn } from "@cleanhub/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { filterSidebarSections } from "@/config/feature-visibility";
import { getNavIcon } from "@/config/nav-icons";
import { webAdminRoutes } from "@/config/routes";
import { getAuthSessionQuery } from "@/features/auth/queries";
import {
  SAAS_PROFILE_UPDATED_EVENT,
  type SaasProfileUpdatedEventDetail,
} from "@/features/saas/profile";
import { useWebAdminLocale } from "@/i18n";

import { SaasGlobalHeader } from "./saas-global-header";

type AdminDashboardShellProps = {
  children: React.ReactNode;
  scope: "saas" | "tenant";
};

function isActivePath(pathname: string, href: string): boolean {
  if (href === webAdminRoutes.saas.home) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getRoleLabel(authContext: AuthContext | null): string {
  if (!authContext) {
    return "Admin User";
  }

  return authContext.role
    .split("_")
    .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getDisplayName(authContext: AuthContext | null): string {
  return authContext?.displayName.trim() || getRoleLabel(authContext);
}

export function AdminDashboardShell({
  children,
  scope,
}: AdminDashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { messages, setLocale } = useWebAdminLocale();
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const platformSettingsHref = webAdminRoutes.saas.config.platformSettings;
  // The backend already refuses privileged writes from support staff; hiding
  // the links keeps the console honest about what this account can do.
  const saasRole =
    authContext && isSaasAdminRole(authContext.role) ? authContext.role : null;
  const sidebarItems = useMemo(
    () =>
      filterSidebarSections(messages.sidebar.saas, saasRole)
        .flatMap((section) => section.items)
        .filter((item) => item.href !== platformSettingsHref),
    [messages.sidebar.saas, platformSettingsHref, saasRole],
  );
  const settingsActive = isActivePath(pathname, platformSettingsHref);
  const SettingsIcon = getNavIcon(platformSettingsHref);
  const displayName = useMemo(() => getDisplayName(authContext), [authContext]);

  useEffect(() => {
    let active = true;

    async function loadSession() {
      const session = await getAuthSessionQuery();

      if (!active) {
        return;
      }

      if (session) {
        setAuthContext(session);
        if (session.language) setLocale(session.language);
      } else {
        router.replace(webAdminRoutes.login);
      }
    }

    loadSession();

    return () => {
      active = false;
    };
  }, [router, setLocale]);

  useEffect(() => {
    function handleProfileUpdated(event: Event) {
      const detail = (event as CustomEvent<SaasProfileUpdatedEventDetail>)
        .detail;

      if (!detail?.displayName) {
        return;
      }

      setAuthContext((current) =>
        current
          ? {
              ...current,
              displayName: detail.displayName,
              language: detail.language,
            }
          : current,
      );
      setLocale(detail.language);
    }

    window.addEventListener(SAAS_PROFILE_UPDATED_EVENT, handleProfileUpdated);

    return () => {
      window.removeEventListener(
        SAAS_PROFILE_UPDATED_EVENT,
        handleProfileUpdated,
      );
    };
  }, [setLocale]);

  if (scope !== "saas") {
    return children;
  }

  if (settingsActive) {
    return (
      <div
        className="min-h-screen bg-[#f1f1f1] text-foreground"
        data-testid="saas-settings-shell"
      >
        <SaasGlobalHeader
          authContext={authContext}
          copy={messages.shell.saas.header}
          displayName={displayName}
        />
        <main className="min-w-0">{children}</main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-muted/30 text-foreground"
      data-testid="saas-dashboard-shell"
    >
      <SaasGlobalHeader
        authContext={authContext}
        copy={messages.shell.saas.header}
        displayName={displayName}
      />

      <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside
          className="flex flex-col border-b bg-sidebar px-3 py-4 text-sidebar-foreground lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:border-b-0 lg:border-r"
          data-testid="saas-sidebar"
        >
          <nav
            aria-label="saas sidebar"
            className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto pb-5"
          >
            {sidebarItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              const IconComponent = getNavIcon(item.href);

              return (
                <Link
                  aria-current={active ? "page" : undefined}
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
                >
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity",
                      active && "opacity-100",
                    )}
                  />
                  {IconComponent ? (
                    <Icon
                      aria-hidden
                      className={cn(
                        "text-muted-foreground transition-colors",
                        active && "text-sidebar-accent-foreground",
                      )}
                      icon={IconComponent}
                      size={16}
                    />
                  ) : null}
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t pt-3">
            <Link
              aria-current={settingsActive ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                settingsActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground",
              )}
              href={platformSettingsHref}
            >
              {SettingsIcon ? (
                <Icon aria-hidden icon={SettingsIcon} size={16} />
              ) : null}
              <span className="truncate">
                {
                  messages.sidebar.saas
                    .flatMap((section) => section.items)
                    .find((item) => item.href === platformSettingsHref)?.label
                }
              </span>
            </Link>
          </div>
        </aside>

        <main className="min-w-0 px-5 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
