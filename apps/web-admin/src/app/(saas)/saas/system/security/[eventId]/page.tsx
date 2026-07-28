import { isUlid } from "@cleanhub/id";
import { notFound } from "next/navigation";

import { SecurityEventDetailView } from "@/features/saas/security";

type SecurityEventDetailPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function SecurityEventDetailPage({
  params,
}: SecurityEventDetailPageProps) {
  const { eventId } = await params;

  if (!isUlid(eventId)) {
    notFound();
  }

  return <SecurityEventDetailView eventId={eventId} />;
}
