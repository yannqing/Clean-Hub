import { redirect } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";

type SecurityEventDetailPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

export default async function SecurityEventDetailPage({
  params,
}: SecurityEventDetailPageProps) {
  const { eventId } = await params;

  redirect(webAdminRoutes.saas.auditSecurityEvent(eventId));
}
