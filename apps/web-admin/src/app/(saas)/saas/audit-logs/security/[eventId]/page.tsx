import { isUlid } from "@cleanhub/id";
import { notFound } from "next/navigation";

import { SecurityEventDetailView } from "@/features/saas/security";

export default async function SecurityEventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  if (!isUlid(eventId)) notFound();
  return <SecurityEventDetailView eventId={eventId} />;
}
