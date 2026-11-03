"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import type { ServiceTicketOverview } from "@cleanhub/api-client";

import { Icon } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";

type MetricCardProps = {
  label: string;
  value: number | string;
  icon: Parameters<typeof Icon>[0]["name"];
};

function MetricCard({ label, value, icon }: MetricCardProps) {
  return (
    <section className="flex min-h-20 items-center gap-2.5 rounded-md border bg-background px-3 py-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-[15px]" name={icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block truncate text-lg font-semibold text-foreground">
          {value}
        </span>
      </span>
    </section>
  );
}

/**
 * Top metrics row on the list page. Derives four counts from the overview DTO.
 * Renders nothing when the overview call failed (e.g. no permission).
 */
export function TicketMetrics({
  overview,
}: {
  overview: ServiceTicketOverview | null;
}) {
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);

  const openCount = overview
    ? (overview.byStatus.pending ?? 0) + (overview.byStatus.in_progress ?? 0)
    : "—";
  const readyCount = overview?.byStatus.ready_to_pick ?? (overview ? 0 : "—");
  const overdueCount = overview?.overdueCount ?? "—";
  const todayCreatedCount = overview?.todayCreatedCount ?? "—";

  return (
    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
      <MetricCard
        icon="clipboard-list"
        label={text("进行中工单")}
        value={openCount}
      />
      <MetricCard
        icon="package-check"
        label={text("待取件")}
        value={readyCount}
      />
      <MetricCard icon="clock" label={text("已逾期")} value={overdueCount} />
      <MetricCard
        icon="clipboard-list"
        label={text("今日新增")}
        value={todayCreatedCount}
      />
    </div>
  );
}
