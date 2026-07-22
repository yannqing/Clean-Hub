"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import type { ServiceTicketOverview } from "@cleanhub/api-client";

import { Icon } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";

type MetricTone = "blue" | "violet" | "amber" | "red";

const METRIC_TONE_CLASSES: Record<MetricTone, string> = {
  blue: "text-blue-700 bg-blue-50",
  violet: "text-violet-700 bg-violet-50",
  amber: "text-amber-700 bg-amber-50",
  red: "text-red-700 bg-red-50",
};

type MetricCardProps = {
  label: string;
  value: number;
  note: string;
  icon: Parameters<typeof Icon>[0]["name"];
  tone: MetricTone;
};

function MetricCard({ label, value, note, icon, tone }: MetricCardProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${METRIC_TONE_CLASSES[tone]}`}
        >
          <Icon className="h-4 w-4" name={icon} />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{note}</div>
    </section>
  );
}

/**
 * Top metrics row on the list page. Derives four counts from the overview DTO.
 * Renders nothing when the overview call failed (e.g. no permission).
 */
export function TicketMetrics({ overview }: { overview: ServiceTicketOverview | null }) {
  const { locale } = useTranslation();

  if (!overview) {
    return null;
  }

  const text = (value: string) => translatePosText(value, locale);

  const openCount =
    (overview.byStatus.pending ?? 0) +
    (overview.byStatus.in_progress ?? 0);
  const readyCount = overview.byStatus.ready_to_pick ?? 0;
  const overdueCount = overview.overdueCount ?? 0;
  const todayCreatedCount = overview.todayCreatedCount ?? 0;

  return (
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard
        icon="clipboard-list"
        label={text("进行中工单")}
        note={text("待处理 + 处理中")}
        tone="blue"
        value={openCount}
      />
      <MetricCard
        icon="package-check"
        label={text("待取件")}
        note={text("等待客户到店")}
        tone="violet"
        value={readyCount}
      />
      <MetricCard
        icon="clock"
        label={text("已逾期")}
        note={text("超过预计取件时间")}
        tone="red"
        value={overdueCount}
      />
      <MetricCard
        icon="clipboard-list"
        label={text("今日新增")}
        note={text("今日创建的工单")}
        tone="amber"
        value={todayCreatedCount}
      />
    </div>
  );
}
