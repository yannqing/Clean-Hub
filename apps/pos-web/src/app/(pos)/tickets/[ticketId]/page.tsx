import type {
  PosCatalogService,
  RelatedOrderSummary,
} from "@cleanhub/api-client";
import { notFound } from "next/navigation";

import { TicketDetailView } from "@/features/tickets/components/ticket-detail-view";
import {
  getPosCatalogQuery,
  getRelatedOrdersQuery,
  getTicketDetailQuery,
} from "@/features/tickets/queries";
import { getCurrentUser } from "@/lib/auth";

type TicketDetailPageProps = {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ from?: string; q?: string }>;
};

export default async function TicketDetailPage({
  params,
  searchParams,
}: TicketDetailPageProps) {
  const [{ ticketId }, { from, q }] = await Promise.all([params, searchParams]);

  const [ticket, relatedOrders, catalog, user] = await Promise.all([
    getTicketDetailQuery(ticketId),
    // Related orders are best-effort: a failure here must not break the page.
    getRelatedOrdersQuery(ticketId).catch(() => ({
      data: [] as RelatedOrderSummary[],
    })),
    getPosCatalogQuery().catch(() => ({ data: [] as PosCatalogService[] })),
    getCurrentUser(),
  ]);

  if (!ticket) {
    notFound();
  }

  return (
    <TicketDetailView
      canManage={user?.role === "owner" || user?.role === "manager"}
      catalog={catalog.data}
      from={from}
      intakeQuery={q}
      relatedOrders={relatedOrders?.data ?? []}
      ticket={ticket}
    />
  );
}

export function generateMetadata() {
  return { title: "工单详情" };
}
