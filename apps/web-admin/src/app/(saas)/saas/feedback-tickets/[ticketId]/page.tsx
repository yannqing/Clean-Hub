import { isApiHttpError } from "@cleanhub/api-client";
import { isUlid } from "@cleanhub/id";
import { notFound } from "next/navigation";

import { FeedbackTicketDetailView } from "@/features/saas/feedback-tickets/components";
import { getFeedbackTicketDetailQuery } from "@/features/saas/feedback-tickets/queries";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";

type FeedbackTicketDetailPageProps = {
  params: Promise<{
    ticketId: string;
  }>;
};

export default async function FeedbackTicketDetailPage({
  params,
}: FeedbackTicketDetailPageProps) {
  const { ticketId } = await params;

  if (!isUlid(ticketId)) {
    notFound();
  }

  let ticket:
    | Awaited<ReturnType<typeof getFeedbackTicketDetailQuery>>
    | undefined;

  try {
    ticket = await getFeedbackTicketDetailQuery(
      ticketId,
      await getSaasServerApiRequestOptions(),
    );
  } catch (error) {
    if (
      isApiHttpError(error) &&
      (error.status === 403 || error.status === 404)
    ) {
      notFound();
    }

    throw error;
  }

  if (!ticket) {
    notFound();
  }

  return <FeedbackTicketDetailView initialTicket={ticket} />;
}
