"use client";

import { useTranslation } from "@cleanhub/i18n/react";
import type { PosOrderOverview } from "@cleanhub/api-client";

import { Icon } from "@/components/app-shell";
import { translatePosText } from "@/components/i18n/pos-runtime-text";

import { formatOrderMoney } from "../constants";

type MetricCardProps = {
  label: string;
  value: string | number;
  icon: Parameters<typeof Icon>[0]["name"];
};

const PERIOD_LABELS: Record<PosOrderOverview["period"], string> = {
  all: "全部订单",
  today: "今日订单",
  week: "近 7 天订单",
  month: "本月订单",
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

export function OrderMetrics({ overview }: { overview: PosOrderOverview }) {
  const { locale } = useTranslation();
  const text = (value: string) => translatePosText(value, locale);

  return (
    <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
      <MetricCard
        icon="receipt"
        label={text(PERIOD_LABELS[overview.period])}
        value={overview.orderCount}
      />
      <MetricCard
        icon="wallet-cards"
        label={text("已收金额")}
        value={formatOrderMoney(overview.paidAmount, overview.currency, locale)}
      />
      <MetricCard
        icon="clock"
        label={text("待支付")}
        value={overview.unpaidCount + overview.partialCount}
      />
      <MetricCard
        icon="package-check"
        label={text("已交付")}
        value={overview.deliveredCount}
      />
    </div>
  );
}
