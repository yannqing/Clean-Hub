import type {
  PosCatalogService,
  RelatedOrderSummary,
} from "@cleanhub/api-client";
import { notFound } from "next/navigation";

import { TicketDetailView } from "@/features/tickets/components/ticket-detail-view";
import { getPosCatalogQuery } from "@/features/catalog/queries";
import {
  getRelatedOrdersQuery,
  getTicketDetailQuery,
} from "@/features/tickets/queries";
import { getCurrentUser } from "@/lib/auth";

type TicketDetailPageProps = {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ from?: string; q?: string; serviceId?: string }>;
};

export default async function TicketDetailPage({
  params,
  searchParams,
}: TicketDetailPageProps) {
  const [{ ticketId }, { from, q, serviceId }] = await Promise.all([
    params,
    searchParams,
  ]);

  const [ticket, relatedOrders, user] = await Promise.all([
    getTicketDetailQuery(ticketId),
    // Related orders are best-effort: a failure here must not break the page.
    getRelatedOrdersQuery(ticketId).catch(() => ({
      data: [] as RelatedOrderSummary[],
    })),
    getCurrentUser(),
  ]);

  if (!ticket) {
    notFound();
  }
  const catalog = await getPosCatalogQuery({
    branchId: ticket.branchId,
  }).catch(() => ({
    data: [] as PosCatalogService[],
    products: [],
  }));

  return (
    <TicketDetailView
      canManage={user?.role === "owner" || user?.role === "manager"}
      catalog={catalog.data}
      from={from}
      intakeQuery={q}
      prefillServiceId={serviceId}
      relatedOrders={relatedOrders?.data ?? []}
      ticket={ticket}
    />
  );
}

export function generateMetadata() {
  return { title: "工单详情" };
}
