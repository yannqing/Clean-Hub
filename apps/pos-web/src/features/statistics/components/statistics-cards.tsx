"use client";

import { type ServiceTicketOverview } from "@cleanhub/api-client";

type StatCard = {
  label: string;
  value: number;
  color: "blue" | "orange" | "red" | "green";
};

function deriveStatCards(overview: ServiceTicketOverview): StatCard[] {
  const inProgress =
    (overview.byStatus.pending ?? 0) + (overview.byStatus.in_progress ?? 0);

  return [
    {
      label: "进行中工单",
      value: inProgress,
      color: "blue",
    },
    {
      label: "待取件",
      value: overview.byStatus.ready_to_pick ?? 0,
      color: "orange",
    },
    {
      label: "已逾期",
      value: overview.overdueCount,
      color: "red",
    },
    {
      label: "今日新增",
      value: overview.todayCreatedCount,
      color: "green",
    },
  ];
}

const COLOR_MAP = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    badge: "bg-blue-100 text-blue-700",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-600",
    badge: "bg-orange-100 text-orange-700",
  },
  red: {
    bg: "bg-red-50",
    text: "text-red-600",
    badge: "bg-red-100 text-red-700",
  },
  green: {
    bg: "bg-green-50",
    text: "text-green-600",
    badge: "bg-green-100 text-green-700",
  },
} as const;

function StatCardItem({ card }: { card: StatCard }) {
  const colors = COLOR_MAP[card.color];

  return (
    <div className={`rounded-xl border border-slate-200 ${colors.bg} p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{card.label}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${colors.badge}`}
        >
          {card.value}
        </span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${colors.text}`}>{card.value}</p>
    </div>
  );
}

export function StatisticsCards({
  overview,
}: {
  overview: ServiceTicketOverview | null;
}) {
  if (!overview) {
    return null;
  }

  const cards = deriveStatCards(overview);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <StatCardItem key={card.label} card={card} />
      ))}
    </div>
  );
}
