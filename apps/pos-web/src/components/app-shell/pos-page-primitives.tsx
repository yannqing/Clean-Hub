import { cn } from "@cleanhub/ui";
import type { ReactNode } from "react";

import { Icon, type PosIconName } from "./icons";

type PosPageHeaderProps = {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon: PosIconName;
  title: ReactNode;
};

export function PosPageHeader({
  actions,
  className,
  description,
  icon,
  title,
}: PosPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-slate-950">
          <Icon
            aria-hidden
            className="h-[18px] w-[18px] shrink-0 text-slate-600"
            name={icon}
          />
          <span className="min-w-0 truncate">{title}</span>
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export type PosMetric = {
  icon: PosIconName;
  label: string;
  note?: ReactNode;
  value: ReactNode;
};

type PosMetricStripProps = {
  ariaLabel?: string;
  className?: string;
  loading?: boolean;
  metrics: readonly PosMetric[];
};

export function PosMetricStrip({
  ariaLabel,
  className,
  loading = false,
  metrics,
}: PosMetricStripProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        "grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {metrics.map((metric) => (
        <div
          className="flex min-h-20 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2.5"
          key={metric.label}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <Icon aria-hidden className="h-4 w-4" name={metric.icon} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-medium text-slate-500">
              {metric.label}
            </span>
            {loading ? (
              <span className="mt-1.5 block h-5 w-20 animate-pulse rounded bg-slate-200" />
            ) : (
              <span className="mt-0.5 block truncate text-lg font-semibold text-slate-950">
                {metric.value}
              </span>
            )}
            {metric.note ? (
              <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                {metric.note}
              </span>
            ) : null}
          </span>
        </div>
      ))}
    </section>
  );
}

type PosTableSurfaceProps = {
  children: ReactNode;
  className?: string;
};

export function PosTableSurface({
  children,
  className,
}: PosTableSurfaceProps) {
  return (
    <section
      className={cn(
        "min-w-0 border-y border-slate-200 bg-white",
        className,
      )}
    >
      {children}
    </section>
  );
}

type PosFormLayoutProps = {
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
};

export function PosFormLayout({
  aside,
  children,
  className,
  footer,
}: PosFormLayoutProps) {
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-[960px] space-y-3 pb-20",
        className,
      )}
    >
      <div
        className={cn(
          "grid items-start gap-5",
          aside && "lg:grid-cols-[minmax(0,1fr)_280px]",
        )}
      >
        <div className="min-w-0">{children}</div>
        {aside ? <aside className="min-w-0">{aside}</aside> : null}
      </div>
      {footer ? <div className="pt-2">{footer}</div> : null}
    </section>
  );
}

type PosEmptyStateProps = {
  action?: ReactNode;
  className?: string;
  description?: ReactNode;
  icon?: PosIconName;
  title: ReactNode;
};

export function PosEmptyState({
  action,
  className,
  description,
  icon = "search-x",
  title,
}: PosEmptyStateProps) {
  return (
    <section
      className={cn(
        "flex min-h-64 flex-col items-center justify-center border-y border-slate-200 bg-white px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-md bg-slate-100 text-slate-500">
        <Icon aria-hidden className="h-5 w-5" name={icon} />
      </span>
      <h1 className="mt-4 text-base font-semibold text-slate-900">{title}</h1>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

export const posCompactTableClassName =
  "text-xs [&_td]:px-2.5 [&_td]:py-2.5 [&_th]:h-10 [&_th]:px-2.5";
