import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Icon } from "../ui/icon";
import { Table } from "../ui/table";

export const dataTableCompactClassName =
  "text-xs [&_td]:px-2 [&_td]:py-2 [&_th]:h-9 [&_th]:px-2";

export const dataTableComfortableClassName =
  "text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:h-10 [&_th]:px-4";

type DataTableProps = ComponentProps<typeof Table> & {
  density?: "compact" | "comfortable";
};

export function DataTable({
  className,
  density = "compact",
  ...props
}: DataTableProps) {
  return (
    <Table
      className={cn(
        density === "compact"
          ? dataTableCompactClassName
          : dataTableComfortableClassName,
        className,
      )}
      {...props}
    />
  );
}

type DataTableSurfaceProps = {
  children: ReactNode;
  className?: string;
};

export function DataTableSurface({
  children,
  className,
}: DataTableSurfaceProps) {
  return (
    <section className={cn("min-w-0 border-y bg-background", className)}>
      {children}
    </section>
  );
}

type DataTableToolbarProps = {
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  filters?: ReactNode;
  search?: ReactNode;
};

export function DataTableToolbar({
  actions,
  children,
  className,
  filters,
  search,
}: DataTableToolbarProps) {
  return (
    <div
      className={cn("flex items-center gap-2 border-b px-3 py-2.5", className)}
    >
      {children ?? (
        <>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            {filters}
            {search}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </>
      )}
    </div>
  );
}

export type DataTableMetric = {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
};

type DataTableMetricCardsProps = {
  ariaLabel?: string;
  className?: string;
  loading?: boolean;
  metrics: readonly DataTableMetric[];
};

export function DataTableMetricCards({
  ariaLabel,
  className,
  loading = false,
  metrics,
}: DataTableMetricCardsProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn("grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4", className)}
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

type DataTablePagePaginationProps = {
  loading?: boolean;
  nextLabel: string;
  onPageChange: (page: number) => void;
  page: number;
  previousLabel: string;
  summary?: ReactNode;
  totalPages: number;
};

export function DataTablePagePagination({
  loading = false,
  nextLabel,
  onPageChange,
  page,
  previousLabel,
  summary,
  totalPages,
}: DataTablePagePaginationProps) {
  return (
    <div className="flex flex-col gap-2 border-t px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
      <span className="text-muted-foreground">{summary}</span>
      <div className="flex gap-2">
        <Button
          className="h-7 px-2 text-xs"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          size="sm"
          type="button"
          variant="outline"
        >
          {previousLabel}
        </Button>
        <Button
          className="h-7 px-2 text-xs"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          size="sm"
          type="button"
          variant="outline"
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

type DataTablePaginationProps = {
  currentPageCount: number;
  formatCountLabel?: (range: {
    from: number;
    to: number;
    total: number;
  }) => string;
  hasNext?: boolean;
  nextLabel: string;
  offset: number;
  onOffsetChange: (nextOffset: number) => void;
  pageSize: number;
  previousLabel: string;
  total?: number;
};

export function DataTablePagination({
  currentPageCount,
  formatCountLabel,
  hasNext: hasNextOverride,
  nextLabel,
  offset,
  onOffsetChange,
  pageSize,
  previousLabel,
  total,
}: DataTablePaginationProps) {
  const hasPrevious = offset > 0;
  const hasNext =
    hasNextOverride ??
    (total != null ? offset + pageSize < total : currentPageCount >= pageSize);
  const rangeStart = total != null && total > 0 ? offset + 1 : 0;
  const rangeEnd =
    total != null ? Math.min(offset + pageSize, total) : currentPageCount;

  return (
    <div className="flex items-center justify-between border-t px-5 py-3">
      {total != null ? (
        <span className="text-sm text-muted-foreground">
          {formatCountLabel
            ? formatCountLabel({
                from: rangeStart,
                to: rangeEnd,
                total,
              })
            : `${rangeStart}–${rangeEnd} of ${total}`}
        </span>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <Button
          disabled={!hasPrevious}
          onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}
          type="button"
          variant="outline"
        >
          {previousLabel}
        </Button>
        <Button
          disabled={!hasNext}
          onClick={() => onOffsetChange(offset + pageSize)}
          type="button"
          variant="outline"
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
