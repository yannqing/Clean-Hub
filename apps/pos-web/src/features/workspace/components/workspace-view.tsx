"use client";

import type { PosWorkspaceOverview } from "@cleanhub/api-client";
import type { PosSessionUser } from "@/lib/session";
import { Icon } from "@/components/app-shell/icons";
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
  const today = new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="space-y-7">
      {/* 欢迎区：品牌渐变英雄头部 */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div
          aria-hidden
          className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-gradient-to-br from-blue-100 to-violet-100 opacity-70"
        />
        <div
          aria-hidden
          className="absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-gradient-to-tr from-violet-50 to-blue-50 opacity-80"
        />
        <div className="relative flex flex-wrap items-center gap-5">
          {user ? (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-2xl font-bold text-white shadow-lg shadow-blue-500/20">
              {user.displayName.charAt(0).toUpperCase()}
            </div>
          ) : (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-lg shadow-blue-500/20">
              <Icon name="layout-dashboard" className="h-7 w-7" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                工作台
              </p>
            </div>
            <h1 className="mt-1 truncate text-2xl font-bold text-slate-950">
              {user ? `欢迎回来，${user.displayName}` : "工作台"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-500">
              {roleLabel ? (
                <span className="inline-flex items-center gap-1">
                  <Icon name="users" className="h-3.5 w-3.5 text-slate-400" />
                  {roleLabel}
                </span>
              ) : null}
              <span className="hidden text-slate-300 sm:inline">·</span>
              <span className="inline-flex items-center gap-1">
                <Icon name="clock" className="h-3.5 w-3.5 text-slate-400" />
                {today}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 门店卡片 */}
      <WorkspaceBranchCard branch={overview?.branch ?? null} />

      {/* 今日统计 */}
      <WorkspaceStatistics statistics={overview?.statistics ?? null} />

      {/* 快捷操作 */}
      <WorkspaceQuickActions actions={overview?.quickActions ?? []} />

      {/* 待办任务 + 最近活动 双栏布局（大屏下） */}
      <div className="grid grid-cols-1 gap-7 xl:grid-cols-2">
        <PendingTasks />
        <RecentActivities />
      </div>
    </div>
  );
}
