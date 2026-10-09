import { isApiHttpError } from "@cleanhub/api-client";
import { notFound } from "next/navigation";

import { SaasAuditLogDetailView } from "@/features/saas/audit-logs/components";
import { getSaasAuditLogDetailQuery } from "@/features/saas/audit-logs/queries";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

type SaasAuditLogDetailPageProps = {
  params: Promise<{
    logId: string;
  }>;
};

export default async function SaasAuditLogDetailPage({
  params,
}: SaasAuditLogDetailPageProps) {
  const { logId } = await params;

  if (!ULID_PATTERN.test(logId)) {
    notFound();
  }

  let log: Awaited<ReturnType<typeof getSaasAuditLogDetailQuery>> | undefined;

  try {
    log = await getSaasAuditLogDetailQuery(
      logId,
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

  if (!log) {
    notFound();
  }

  return <SaasAuditLogDetailView initialLog={log} />;
}
