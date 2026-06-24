import { notFound } from "next/navigation";

import { TicketDetailView } from "@/features/tickets/components/ticket-detail-view";
import {
  getRelatedOrdersQuery,
  getTicketDetailQuery,
} from "@/features/tickets/queries";

type TicketDetailPageProps = {
  params: Promise<{ ticketId: string }>;
};

export default async function TicketDetailPage({
  params,
}: TicketDetailPageProps) {
  const { ticketId } = await params;

  const [ticket, relatedOrders] = await Promise.all([
    getTicketDetailQuery(ticketId),
    // Related orders are best-effort: a failure here must not break the page.
    getRelatedOrdersQuery(ticketId).catch(() => ({ data: [] })),
  ]);

  if (!ticket) {
    notFound();
  }

  return <TicketDetailView relatedOrders={relatedOrders.data} ticket={ticket} />;
}

export function generateMetadata() {
  return { title: "工单详情" };
}
