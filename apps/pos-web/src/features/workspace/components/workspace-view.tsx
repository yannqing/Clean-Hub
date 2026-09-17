"use client";

import type {
  PosPendingTask,
  PosRecentActivity,
  PosWorkspaceOverview,
} from "@cleanhub/api-client";
import { useTranslation } from "@cleanhub/i18n/react";
import type { PosSessionUser } from "@/lib/session";
import { Icon } from "@/components/app-shell/icons";
import { usePosRuntimeConfig } from "@/components/runtime/pos-runtime-config";
import { posMessage } from "@/lib/pos-message";
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
  const { timeZone } = usePosRuntimeConfig();
  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : null;
  const canReprint = user?.role === "owner" || user?.role === "manager";
  const today = new Date().toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone,
  });

  return (
    <div className="space-y-7 pb-8">
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-2">
          <Icon
            aria-hidden
            className="mt-0.5 h-[19px] w-[19px] shrink-0"
            name="layout-dashboard"
          />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {user
                ? posMessage("pos.inline.welcomeBack", {
                    name: user.displayName,
                  })
                : "工作台"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              今日事，今日毕。按轻重缓急，稳妥完成每一次接待与交付。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {roleLabel ? (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 font-medium">
              <Icon name="users" className="h-3.5 w-3.5" />
              {roleLabel}
            </span>
          ) : null}
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-background px-3 font-medium">
            <Icon name="clock" className="h-3.5 w-3.5" />
            {today}
          </span>
        </div>
      </section>

      <WorkspaceBranchCard branch={overview?.branch ?? null} />
      <WorkspaceStatistics statistics={overview?.statistics ?? null} />
      <WorkspaceQuickActions actions={overview?.quickActions ?? []} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PendingTasks canReprint={canReprint} tasks={pendingTasks} />
        <RecentActivities activities={recentActivities} />
      </div>
    </div>
  );
}
