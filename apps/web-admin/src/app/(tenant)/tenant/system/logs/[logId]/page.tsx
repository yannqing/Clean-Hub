import { isApiHttpError } from "@cleanhub/api-client";
import { notFound } from "next/navigation";

import { TenantAuditLogDetailView } from "@/features/tenant/audit-logs/components";
import { getTenantAuditLogDetailQuery } from "@/features/tenant/audit-logs/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

type TenantAuditLogDetailPageProps = {
  params: Promise<{
    logId: string;
  }>;
};

export default async function TenantAuditLogDetailPage({
  params,
}: TenantAuditLogDetailPageProps) {
  const { logId } = await params;

  if (!ULID_PATTERN.test(logId)) {
    notFound();
  }

  let log: Awaited<ReturnType<typeof getTenantAuditLogDetailQuery>> | undefined;

  try {
    log = await getTenantAuditLogDetailQuery(
      logId,
      await getTenantServerApiRequestOptions(),
    );
  } catch (error) {
    if (isApiHttpError(error) && (error.status === 403 || error.status === 404)) {
      notFound();
    }

    throw error;
  }

  if (!log) {
    notFound();
  }

  return <TenantAuditLogDetailView initialLog={log} />;
}
