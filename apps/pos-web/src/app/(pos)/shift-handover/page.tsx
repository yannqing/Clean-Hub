import { getMyBranchQuery } from "@/features/branches/queries";
import { PosOperationsView } from "@/features/shift-handover/components";
import { getShiftHandoverSummaryQuery } from "@/features/shift-handover/queries";
import { getShiftOperationsQuery } from "@/features/shift-handover/queries";
import { getCurrentUser } from "@/lib/auth";

export default async function ShiftHandoverPage() {
  const [user, branch, operations] = await Promise.all([
    getCurrentUser(),
    getMyBranchQuery().catch(() => null),
    getShiftOperationsQuery(),
  ]);
  // Align order totals with the active register window used by the Z Report.
  const summary = await getShiftHandoverSummaryQuery({
    shiftStartedAt: operations.register.registerSession?.openedAt ?? null,
    timeZone: user?.timezone,
  });

  return (
    <PosOperationsView
      branch={branch}
      currentShift={operations.currentShift}
      register={operations.register}
      recentReports={operations.recentReports}
      reconciliation={operations.reconciliation}
      summary={summary}
      user={user}
    />
  );
}
