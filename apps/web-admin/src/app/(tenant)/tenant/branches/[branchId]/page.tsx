import { Badge, Button } from "@cleanhub/ui";
import Link from "next/link";

import { webAdminRoutes } from "@/config/routes";
import { BranchDetailView } from "@/features/tenant/branches/components";
import { getBranchDetailQuery } from "@/features/tenant/branches/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { getWebAdminMessages } from "@/i18n/messages";
import { getWebAdminLocaleFromCookies } from "@/i18n/locale.server";
import { getWebAdminFeedbackTranslator } from "@/i18n/feedback";

type BranchDetailPageProps = {
  params: Promise<{
    branchId: string;
  }>;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error
    ? error.message
    : fallback;
}

export default async function BranchDetailPage({
  params,
}: BranchDetailPageProps) {
  const { branchId } = await params;
  const locale = await getWebAdminLocaleFromCookies();
  const messages = await getWebAdminMessages(locale);
  const copy = messages.tenant.branches.unavailable;
  const feedback = getWebAdminFeedbackTranslator(locale, messages, "tenant");
  const result = await getBranchDetailQuery(
    branchId,
    await getTenantServerApiRequestOptions(),
  )
    .then((branch) => ({ branch, error: undefined }))
    .catch((error: unknown) => ({
      branch: undefined,
      error: getErrorMessage(error, copy.description),
    }));

  if (result.branch) {
    return <BranchDetailView initialBranch={result.branch} />;
  }

  return (
    <section className="grid gap-5 p-5">
      <div className="rounded-md border bg-background p-5">
        <Badge variant="secondary">{copy.badge}</Badge>
        <h1 className="mt-3 text-2xl font-semibold tracking-normal">
          {copy.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {feedback(result.error ?? copy.description)}
        </p>
        <Button asChild className="mt-5" type="button" variant="outline">
          <Link href={webAdminRoutes.tenant.branches}>{copy.back}</Link>
        </Button>
      </div>
    </section>
  );
}
