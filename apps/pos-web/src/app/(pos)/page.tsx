import { WorkspaceView } from "@/features/workspace/components/workspace-view";
import {
  getPendingTasksQuery,
  getRecentActivitiesQuery,
  getWorkspaceOverviewQuery,
} from "@/features/workspace/queries";
import { getCurrentUser } from "@/lib/auth";

export default async function WorkspacePage() {
  // Parallel data fetch — all are independent server queries.
  // Recent activities and pending tasks are bound to real orders/tickets/customers
  // via the existing @cleanhub/api-client workspace methods (no client-side fetch).
  const [user, overview, recentActivities, pendingTasks] = await Promise.all([
    getCurrentUser(),
    getWorkspaceOverviewQuery({}),
    getRecentActivitiesQuery({ limit: 5 }),
    getPendingTasksQuery({}),
  ]);

  return (
    <WorkspaceView
      user={user}
      overview={overview}
      recentActivities={recentActivities.activities}
      pendingTasks={pendingTasks.tasks}
    />
  );
}
