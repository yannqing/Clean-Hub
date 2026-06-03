"use client";

import type { AuthContext } from "@cleanhub/api-client";
import { Card, CardContent, cn } from "@cleanhub/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { LanguageSwitcher } from "@/components/i18n";
import { filterSidebarSections } from "@/config/feature-visibility";
import { webAdminWorkspaceTabs } from "@/config/navigation";
import { webAdminRoutes } from "@/config/routes";
import { LogoutButton } from "@/features/auth/components";
import { useWebAdminLocale } from "@/i18n";
import { webAdminApi } from "@/lib/api-client";

type AdminDashboardShellProps = {
  children: React.ReactNode;
  scope: "saas" | "tenant";
};

function isDashboardHref(href: string): boolean {
  return href === "/saas" || href === "/tenant";
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === href;
  }

  if (isDashboardHref(href)) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function getProfileLabel(authContext: AuthContext | null): string {
  if (!authContext) {
    return "Admin User";
  }

  return authContext.role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getProfileInitials(authContext: AuthContext | null): string {
  if (!authContext) {
    return "AD";
  }

  return authContext.role
    .split("_")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function AdminDashboardShell({
  children,
  scope,
}: AdminDashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { messages } = useWebAdminLocale();
  const [authContext, setAuthContext] = useState<AuthContext | null>(null);
  const copy = messages.shell[scope];
  const sidebarSections = useMemo(
    () => filterSidebarSections(messages.sidebar[scope]),
    [messages.sidebar, scope],
  );
  const tabs = scope === "tenant" ? webAdminWorkspaceTabs.tenant : [];
  const profileHref =
    scope === "saas" ? webAdminRoutes.saas.profile : webAdminRoutes.tenant.profile;
  const profileActive = isActivePath(pathname, profileHref);
  const profileLabel = useMemo(() => getProfileLabel(authContext), [authContext]);
  const profileInitials = useMemo(
    () => getProfileInitials(authContext),
    [authContext],
  );

  useEffect(() => {
    let active = true;

    async function loadSession() {
      try {
        const session = await webAdminApi.auth.me();

        if (!active) {
          return;
        }

        setAuthContext(session);
      } catch {
        if (!active) {
          return;
        }

        router.replace(webAdminRoutes.login);
      }
    }

    loadSession();

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="flex min-h-screen flex-col border-b bg-sidebar px-4 py-5 text-sidebar-foreground lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3 border-b pb-5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              CH
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">CleanHub</p>
              <p className="truncate text-xs text-muted-foreground">
                {copy.eyebrow}
              </p>
            </div>
          </div>

          <nav
            aria-label={`${scope} sidebar`}
            className="mt-5 grid flex-1 content-start gap-6 overflow-y-auto pb-5"
          >
            {sidebarSections.map((section) => (
              <section className="grid gap-2" key={section.title}>
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {section.title}
                </p>
                <div className="grid gap-1">
                  {section.items.map((item) => {
                    const active = isActivePath(pathname, item.href);

                    return (
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex h-9 items-center rounded-md px-3 text-sm font-medium transition-colors",
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
                            "absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity",
                            active && "opacity-100",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>

          <div className="border-t pt-4">
            <div className="flex items-center gap-2">
              <Link
                aria-current={profileActive ? "page" : undefined}
                className={cn(
                  "group flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 transition-colors",
                  "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  profileActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground",
                )}
                href={profileHref}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground ring-1 ring-border">
                  {profileInitials}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {profileLabel}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {messages.common.personalCenter}
                  </span>
                </span>
              </Link>

              <LogoutButton
                className="h-9 px-3 text-xs"
                signOutLabel={messages.common.signOut}
                signingOutLabel={messages.common.signingOut}
              />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="border-b bg-background/95 px-5 py-4 lg:px-8">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {copy.eyebrow}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">{copy.title}</h2>
                <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                  {copy.description}
                </p>
              </div>

              {scope === "saas" ? (
                <LanguageSwitcher />
              ) : (
                <div
                  aria-label={`${scope} tabs`}
                  className="inline-flex w-fit flex-wrap gap-1 rounded-lg border bg-muted p-1"
                  role="tablist"
                >
                  {tabs.map((tab) => {
                    const active = isActivePath(pathname, tab.href);

                    return (
                      <Link
                        aria-current={active ? "page" : undefined}
                        aria-selected={active}
                        className={cn(
                          "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium transition-colors",
                          "hover:bg-background hover:text-foreground",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          active
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground",
                        )}
                        href={tab.href}
                        key={tab.href}
                        role="tab"
                      >
                        {tab.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </header>

          <main className="px-5 py-6 lg:px-8">
            <Card className="rounded-lg">
              <CardContent className="p-0">{children}</CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  );
}
