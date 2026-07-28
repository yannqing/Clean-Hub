import { Icon, cn } from "@cleanhub/ui";
import { ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

type SaasPageHeaderProps = {
  actions?: React.ReactNode;
  className?: string;
  description?: string;
  icon: LucideIcon;
  title: string;
};

export function SaasPageHeader({
  actions,
  className,
  description,
  icon,
  title,
}: SaasPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Icon aria-hidden icon={icon} size={19} />
          <span className="truncate">{title}</span>
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground">
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

type SaasBreadcrumbItem = {
  href?: string;
  label: string;
};

type SaasBreadcrumbsProps = {
  ariaLabel: string;
  className?: string;
  items: readonly SaasBreadcrumbItem[];
  rootHref: string;
  rootIcon: LucideIcon;
  rootLabel: string;
};

export function SaasBreadcrumbs({
  ariaLabel,
  className,
  items,
  rootHref,
  rootIcon,
  rootLabel,
}: SaasBreadcrumbsProps) {
  return (
    <nav aria-label={ariaLabel} className={cn("min-w-0", className)}>
      <ol className="flex min-w-0 items-center gap-2 text-sm">
        <li>
          <Link
            aria-label={rootLabel}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            href={rootHref}
            title={rootLabel}
          >
            <Icon aria-hidden icon={rootIcon} size={16} />
          </Link>
        </li>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;

          return (
            <li className="contents" key={`${item.label}-${index}`}>
              <Icon
                aria-hidden
                className="shrink-0 text-muted-foreground"
                icon={ChevronRight}
                size={14}
              />
              {item.href && !isCurrent ? (
                <Link
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                  href={item.href}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isCurrent ? "page" : undefined}
                  className="max-w-72 truncate font-medium"
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

type SaasMetric = {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
};

type SaasMetricStripProps = {
  ariaLabel?: string;
  loading?: boolean;
  metrics: readonly SaasMetric[];
};

export function SaasMetricStrip({
  ariaLabel,
  loading = false,
  metrics,
}: SaasMetricStripProps) {
  return (
    <section
      aria-label={ariaLabel}
      className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4"
    >
      {metrics.map((metric) => (
        <div
          className="flex min-h-20 items-center gap-2.5 rounded-md border bg-background px-3 py-2.5"
          key={metric.label}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon aria-hidden icon={metric.icon} size={15} />
          </span>
          <span className="min-w-0">
            <span className="block text-[11px] font-medium text-muted-foreground">
              {metric.label}
            </span>
            {loading ? (
              <span className="mt-1.5 block h-5 w-20 animate-pulse rounded bg-muted" />
            ) : (
              <span className="mt-0.5 block truncate text-lg font-semibold">
                {metric.value}
              </span>
            )}
          </span>
        </div>
      ))}
    </section>
  );
}

type SaasTableSurfaceProps = {
  children: React.ReactNode;
  className?: string;
};

export function SaasTableSurface({
  children,
  className,
}: SaasTableSurfaceProps) {
  return (
    <section className={cn("min-w-0 border-y bg-background", className)}>
      {children}
    </section>
  );
}

export const saasCompactTableClassName =
  "text-xs [&_td]:px-2 [&_td]:py-2 [&_th]:h-9 [&_th]:px-2";
