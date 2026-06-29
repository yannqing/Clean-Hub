import { WorkspaceView } from "@/features/workspace/components/workspace-view";
import { getWorkspaceOverviewQuery } from "@/features/workspace/queries";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { posRoutes } from "@/config/routes";

export default async function WorkspacePage() {
  // Parallel data fetch — all are independent server queries.
  const [user, overview] = await Promise.all([
    getCurrentUser(),
    getWorkspaceOverviewQuery({}),
  ]);

  return <WorkspaceView user={user} overview={overview} />;
}
