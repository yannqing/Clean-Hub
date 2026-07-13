import type { PosOrderOverview } from "@cleanhub/api-client";

import { Icon } from "@/components/app-shell";

import { formatOrderMoney } from "../constants";

type MetricTone = "blue" | "violet" | "emerald" | "amber";

const METRIC_TONE_CLASSES: Record<MetricTone, string> = {
  blue: "text-blue-700 bg-blue-50",
  violet: "text-violet-700 bg-violet-50",
  emerald: "text-emerald-700 bg-emerald-50",
  amber: "text-amber-700 bg-amber-50",
};

type MetricCardProps = {
  label: string;
  value: string | number;
  note: string;
  icon: Parameters<typeof Icon>[0]["name"];
  tone: MetricTone;
};

const PERIOD_LABELS: Record<PosOrderOverview["period"], string> = {
  all: "全部订单",
  today: "今日订单",
  week: "近 7 天订单",
  month: "本月订单",
};

const PERIOD_NOTES: Record<PosOrderOverview["period"], string> = {
  all: "当前全部记录",
  today: "今天创建",
  week: "近 7 天创建",
  month: "本月创建",
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

export function OrderMetrics({ overview }: { overview: PosOrderOverview }) {
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <MetricCard
        icon="receipt"
        label={PERIOD_LABELS[overview.period]}
        note={PERIOD_NOTES[overview.period]}
        tone="blue"
        value={overview.orderCount}
      />
      <MetricCard
        icon="wallet-cards"
        label="已收金额"
        note="成功支付流水"
        tone="emerald"
        value={formatOrderMoney(overview.paidAmount, overview.currency)}
      />
      <MetricCard
        icon="clock"
        label="待支付"
        note="未支付 + 部分支付"
        tone="amber"
        value={overview.unpaidCount + overview.partialCount}
      />
      <MetricCard
        icon="package-check"
        label="已交付"
        note={PERIOD_NOTES[overview.period]}
        tone="violet"
        value={overview.deliveredCount}
      />
    </div>
  );
}
