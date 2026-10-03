import { SaasAuditCenterView } from "@/features/saas/audit-logs/components";

export default async function SaasAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return <SaasAuditCenterView view={view === "security" ? "security" : "activity"} />;
}
