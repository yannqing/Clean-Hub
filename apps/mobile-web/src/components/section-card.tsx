"use client";

import type { ComponentType, ReactNode } from "react";

type SectionCardIcon = ComponentType<{
  className?: string;
  "aria-hidden"?: true;
}>;

export function SectionCard({
  action,
  children,
  icon: Icon,
  subtitle,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  icon?: SectionCardIcon;
  subtitle?: string;
  title: string;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            <Icon className="size-5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm leading-5 text-slate-600">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
