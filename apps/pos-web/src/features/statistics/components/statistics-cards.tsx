"use client";

import { type ServiceTicketOverview } from "@cleanhub/api-client";

type StatCard = {
  label: string;
  value: number;
};

function deriveStatCards(overview: ServiceTicketOverview): StatCard[] {
  const inProgress =
    (overview.byStatus.pending ?? 0) + (overview.byStatus.in_progress ?? 0);

  return [
    {
      label: "进行中工单",
      value: inProgress,
    },
    {
      label: "待取件",
      value: overview.byStatus.ready_to_pick ?? 0,
    },
    {
      label: "已逾期",
      value: overview.overdueCount,
    },
    {
      label: "今日新增",
      value: overview.todayCreatedCount,
    },
  ];
}

function StatCardItem({ card }: { card: StatCard }) {
  return (
    <div className="rounded-md border bg-background px-3 py-2.5">
      <span className="text-xs font-medium text-muted-foreground">
        {card.label}
      </span>
      <p className="mt-1 text-lg font-semibold text-foreground">{card.value}</p>
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
