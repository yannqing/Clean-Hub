"use client";

import { type ServiceTicketOverview } from "@cleanhub/api-client";
import { posMessage } from "@/lib/pos-message";

type StatCard = {
  label: string;
  value: number;
};

function deriveStatCards(overview: ServiceTicketOverview): StatCard[] {
  const inProgress =
    (overview.byStatus.pending ?? 0) + (overview.byStatus.in_progress ?? 0);

  return [
    {
      label: posMessage("pos.ticketStat.inProgress"),
      value: inProgress,
    },
    {
      label: posMessage("pos.ticketStat.readyToPick"),
      value: overview.byStatus.ready_to_pick ?? 0,
    },
    {
      label: posMessage("pos.ticketStat.overdue"),
      value: overview.overdueCount,
    },
    {
      label: posMessage("pos.ticketStat.newToday"),
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
