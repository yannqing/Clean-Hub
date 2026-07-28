"use client";

import type {
  PosPendingTask,
  PosRecentActivity,
  PosWorkspaceOverview,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
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
  recentActivities: PosRecentActivity[];
  pendingTasks: PosPendingTask[];
};

const ROLE_LABELS: Record<string, string> = {
  owner: "店主",
  manager: "店长",
  cashier: "收银员",
};

export function WorkspaceView({
  user,
  overview,
  recentActivities,
  pendingTasks,
}: WorkspaceViewProps) {
  const { locale } = useTranslation();
  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : null;
  const today = new Date().toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-white">
            <Icon name="layout-dashboard" className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-500">门店工作台</p>
            <h1 className="mt-0.5 truncate text-lg font-semibold text-slate-950">
              {user ? `欢迎回来，${user.displayName}` : "工作台"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              今日事，今日毕。按轻重缓急，稳妥完成每一次接待与交付。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {roleLabel ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-100 px-3 font-medium">
              <Icon name="users" className="h-3.5 w-3.5" />
              {roleLabel}
            </span>
          ) : null}
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-100 px-3 font-medium">
            <Icon name="clock" className="h-3.5 w-3.5" />
            {today}
          </span>
        </div>
      </section>

      <WorkspaceBranchCard branch={overview?.branch ?? null} />
      <WorkspaceStatistics statistics={overview?.statistics ?? null} />
      <WorkspaceQuickActions actions={overview?.quickActions ?? []} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PendingTasks tasks={pendingTasks} />
        <RecentActivities activities={recentActivities} />
      </div>
    </div>
  );
}
