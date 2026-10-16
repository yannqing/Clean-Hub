"use client";

import { Icon } from "@cleanhub/ui";
import { SquareTerminal } from "lucide-react";

import { useTenantI18n } from "@/i18n";

type PointOfSaleSectionLayoutProps = {
  children: React.ReactNode;
};

export function PointOfSaleSectionLayout({
  children,
}: PointOfSaleSectionLayoutProps) {
  const { m } = useTenantI18n();

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

      </header>

      <div className="pt-5">{children}</div>
    </section>
  );
}
