import { getMyBranchQuery } from "@/features/branches/queries";
import { ShiftHandoverView } from "@/features/shift-handover/components";
import { getShiftHandoverSummaryQuery } from "@/features/shift-handover/queries";
import { getShiftOperationsQuery } from "@/features/shift-handover/queries";
import { getCurrentUser } from "@/lib/auth";

export default async function ShiftHandoverPage() {
  const [user, branch, summary, operations] = await Promise.all([
    getCurrentUser(),
    getMyBranchQuery().catch(() => null),
    getShiftHandoverSummaryQuery(),
    getShiftOperationsQuery(),
  ]);

  return (
    <ShiftHandoverView
      branch={branch}
      currentShift={operations.currentShift}
      recentReports={operations.recentReports}
      staff={operations.staff}
      summary={summary}
      user={user}
    />
  );
}
