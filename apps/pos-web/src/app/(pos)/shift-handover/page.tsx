import { getMyBranchQuery } from "@/features/branches/queries";
import { ShiftHandoverView } from "@/features/shift-handover/components";
import { getShiftHandoverSummaryQuery } from "@/features/shift-handover/queries";
import { getCurrentUser } from "@/lib/auth";

export default async function ShiftHandoverPage() {
  const [user, branch, summary] = await Promise.all([
    getCurrentUser(),
    getMyBranchQuery().catch(() => null),
    getShiftHandoverSummaryQuery(),
  ]);

  return (
    <ShiftHandoverView
      branch={branch}
      summary={summary}
      user={user}
    />
  );
}
