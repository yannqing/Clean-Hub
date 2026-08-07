import { getMyBranchQuery } from "@/features/branches/queries";
import { ShiftHandoverView } from "@/features/shift-handover/components";
import { getShiftHandoverSummaryQuery } from "@/features/shift-handover/queries";
import { getShiftOperationsQuery } from "@/features/shift-handover/queries";
import { getCurrentUser } from "@/lib/auth";

export default async function ShiftHandoverPage() {
  const [user, branch, operations] = await Promise.all([
    getCurrentUser(),
    getMyBranchQuery().catch(() => null),
    getShiftOperationsQuery(),
  ]);
  // The summary window must match the active shift so the on-screen cash
  // figures agree with the server-side Z Report snapshot.
  const summary = await getShiftHandoverSummaryQuery({
    shiftStartedAt: operations.currentShift?.startedAt ?? null,
    timeZone: user?.timezone,
  });

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
