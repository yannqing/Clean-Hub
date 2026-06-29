"use client";

import type { PosWorkspaceOverview } from "@cleanhub/api-client";
import type { PosSessionUser } from "@/lib/session";
import { WorkspaceBranchCard } from "./workspace-branch-card";
import { WorkspaceStatistics } from "./workspace-statistics";
import { WorkspaceQuickActions } from "./workspace-quick-actions";
import { RecentActivities } from "./recent-activities";
import { PendingTasks } from "./pending-tasks";

type WorkspaceViewProps = {
  user: PosSessionUser | null;
  overview: PosWorkspaceOverview | null;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "店主",
  manager: "店长",
  cashier: "收银员",
};

export function WorkspaceView({ user, overview }: WorkspaceViewProps) {
  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : null;

  return (
    <div className="space-y-6">
      {/* 欢迎区 */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          工作台
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          {user ? `欢迎，${user.displayName}` : "工作台"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {roleLabel ? `当前角色：${roleLabel}` : null}
        </p>
      </div>

      {/* 门店卡片 */}
      <WorkspaceBranchCard branch={overview?.branch ?? null} />

      {/* 今日统计 */}
      <WorkspaceStatistics statistics={overview?.statistics ?? null} />

      {/* 快捷操作 */}
      <WorkspaceQuickActions actions={overview?.quickActions ?? []} />

      {/* 待办任务 */}
      <PendingTasks />

      {/* 最近活动 */}
      <RecentActivities />
    </div>
  );
}
