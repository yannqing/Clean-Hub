"use client";

import { Icon, cn } from "@cleanhub/ui";
import { SquareTerminal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";
import { useTenantI18n } from "@/i18n";

type PointOfSaleSectionLayoutProps = {
  children: React.ReactNode;
};

export function PointOfSaleSectionLayout({
  children,
}: PointOfSaleSectionLayoutProps) {
  const pathname = usePathname();
  const { m } = useTenantI18n();
  const tabs = [
    {
      href: webAdminRoutes.tenant.pointOfSale.home,
      label: m.pointOfSale.tabs.overview,
    },
    {
      href: webAdminRoutes.tenant.pointOfSale.devices,
      label: m.pointOfSale.tabs.devices,
    },
    {
      href: webAdminRoutes.tenant.pointOfSale.registerSessions,
      label: m.pointOfSale.tabs.registerSessions,
    },
    {
      href: webAdminRoutes.tenant.pointOfSale.settings,
      label: m.pointOfSale.tabs.settings,
    },
  ];

  return (
    <section className="mx-auto w-full max-w-[1180px] pb-10">
      <header>
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-8 items-center justify-center rounded-lg border bg-background">
            <Icon icon={SquareTerminal} size={16} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              {m.pointOfSale.title}
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              {m.pointOfSale.description}
            </p>
          </div>
        </div>

        <nav
          aria-label={m.pointOfSale.title}
          className="mt-5 flex gap-1 overflow-x-auto border-b"
        >
          {tabs.map((tab) => {
            const active =
              tab.href === webAdminRoutes.tenant.pointOfSale.home
                ? pathname === tab.href
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative shrink-0 px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-foreground",
                )}
                href={tab.href}
                key={tab.href}
              >
                {tab.label}
                <span
                  className={cn(
                    "absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-foreground opacity-0",
                    active && "opacity-100",
                  )}
                />
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="pt-5">{children}</div>
    </section>
  );
}
