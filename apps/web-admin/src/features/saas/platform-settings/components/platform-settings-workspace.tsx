"use client";

import { Input, Label, cn } from "@cleanhub/ui";
import {
  Globe2,
  ReceiptText,
  Search,
  ShieldCheck,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { webAdminRoutes } from "@/config/routes";
import { useSaasI18n } from "@/i18n";

type SectionKey = "defaults" | "taxTemplates" | "security" | "maintenance";

const sections: Array<{ key: SectionKey; href: string; icon: LucideIcon }> = [
  {
    key: "defaults",
    href: webAdminRoutes.saas.config.platformSettingsSections.defaults,
    icon: Globe2,
  },
  {
    key: "taxTemplates",
    href: webAdminRoutes.saas.config.platformSettingsSections.taxTemplates,
    icon: ReceiptText,
  },
  {
    key: "security",
    href: webAdminRoutes.saas.config.platformSettingsSections.security,
    icon: ShieldCheck,
  },
  {
    key: "maintenance",
    href: webAdminRoutes.saas.config.platformSettingsSections.maintenance,
    icon: Wrench,
  },
];

export function PlatformSettingsWorkspace({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { m } = useSaasI18n();
  const [query, setQuery] = useState("");
  const active =
    sections.find((section) => section.href === pathname) ?? sections[0];
  const visibleSections = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return sections.filter((section) =>
      m.platformSettings.workspace.sections[section.key].title
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [m.platformSettings.workspace.sections, query]);
  const ActiveIcon = active.icon;

  return (
    <section
      className="mx-auto w-full max-w-[1280px] pb-16"
      data-testid="saas-settings-workspace"
    >
      <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside
          className="overflow-hidden rounded-xl border bg-background shadow-sm lg:sticky lg:top-20"
          data-testid="saas-settings-sidebar"
        >
          <div className="border-b px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Wrench aria-hidden className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">
                  {m.platformSettings.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.platformSettings.workspace.subtitle}
                </p>
              </div>
            </div>
          </div>
          <div className="border-b p-3">
            <Label className="sr-only" htmlFor="saas-settings-search">
              {m.platformSettings.workspace.searchLabel}
            </Label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="h-9 pl-9 text-sm"
                id="saas-settings-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={m.platformSettings.workspace.searchPlaceholder}
                type="search"
                value={query}
              />
            </div>
          </div>
          <nav aria-label={m.platformSettings.title} className="grid gap-1 p-3">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const selected = section.key === active.key;
              return (
                <Link
                  aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    selected
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                  href={section.href}
                  key={section.key}
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  {m.platformSettings.workspace.sections[section.key].title}
                </Link>
              );
            })}
            {visibleSections.length === 0 ? (
              <p className="px-3 py-5 text-center text-xs text-muted-foreground">
                {m.platformSettings.workspace.noResults}
              </p>
            ) : null}
          </nav>
        </aside>

        <div className="min-w-0">
          <div className="mb-4 flex items-start justify-between gap-3 px-1">
            <div className="flex min-w-0 items-start gap-2">
              <ActiveIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  {m.platformSettings.workspace.sections[active.key].title}
                </h1>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {
                    m.platformSettings.workspace.sections[active.key]
                      .description
                  }
                </p>
              </div>
            </div>
            <Link
              aria-label={m.platformSettings.workspace.closeLabel}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              href={webAdminRoutes.saas.home}
              title={m.platformSettings.workspace.closeLabel}
            >
              <X aria-hidden className="size-5" />
            </Link>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
