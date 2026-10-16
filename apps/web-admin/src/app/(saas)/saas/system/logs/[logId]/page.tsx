import { isApiHttpError } from "@cleanhub/api-client";
import { isUlid } from "@cleanhub/id";
import { notFound } from "next/navigation";

import { OperationLogDetailView } from "@/features/saas/operation-logs/components";
import { getOperationLogDetailQuery } from "@/features/saas/operation-logs/queries";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";

type OperationLogDetailPageProps = {
  params: Promise<{
    logId: string;
  }>;
};

export default async function OperationLogDetailPage({
  params,
}: OperationLogDetailPageProps) {
  const { logId } = await params;

  if (!isUlid(logId)) {
    notFound();
  }

  let log: Awaited<ReturnType<typeof getOperationLogDetailQuery>> | undefined;

  try {
    log = await getOperationLogDetailQuery(
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

  return <OperationLogDetailView initialLog={log} />;
}
