"use client";

import { useEffect, useState } from "react";
import type {
  PosRecentActivity,
  PosRecentActivityType,
} from "@cleanhub/api-client";
import { Icon, type PosIconName } from "@/components/app-shell/icons";

const ACTIVITY_META: Record<
  PosRecentActivityType,
  { label: string; theme: string; icon: PosIconName }
> = {
  order: {
    label: "订单",
    theme: "bg-blue-50 text-blue-600 ring-1 ring-blue-100",
    icon: "receipt",
  },
  ticket: {
    label: "工单",
    theme: "bg-violet-50 text-violet-600 ring-1 ring-violet-100",
    icon: "clipboard-list",
  },
  customer: {
    label: "客户",
    theme: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100",
    icon: "users",
  },
  payment: {
    label: "支付",
    theme: "bg-orange-50 text-orange-600 ring-1 ring-orange-100",
    icon: "wallet-cards",
  },
};

/** 相对时间格式化：将时间戳转为友好的中文相对描述。 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} 小时前`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} 天前`;

  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

function SectionHeader() {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100">
        <Icon name="chart" className="h-[18px] w-[18px]" />
      </span>
      <h2 className="text-sm font-semibold text-slate-800">最近活动</h2>
    </div>
  );
}

export function RecentActivities() {
  const [activities, setActivities] = useState<PosRecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch(
          "/api/workspace/recent-activities?limit=5",
        );
        if (response.ok) {
          const data = await response.json();
          setActivities(data.activities);
        }
      } catch (error) {
        console.error("Failed to fetch recent activities:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, []);

  if (loading) {
    return (
      <section>
        <SectionHeader />
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-9 w-9 animate-pulse rounded-full bg-slate-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-50" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (activities.length === 0) {
    return (
      <section>
        <SectionHeader />
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <Icon name="clock" className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-600">
            暂无最近活动
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            最近的操作记录会显示在这里
          </p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader />
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div>
          {activities.map((activity, index) => {
            const meta = ACTIVITY_META[activity.type] ?? {
              label: activity.type,
              theme: "bg-slate-100 text-slate-600",
              icon: "clipboard-list" as PosIconName,
            };
            const isLast = index === activities.length - 1;

            return (
              <div key={activity.id} className="flex gap-3">
                {/* 时间轴节点 + 连线 */}
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.theme}`}
                  >
                    <Icon name={meta.icon} className="h-[18px] w-[18px]" />
                  </span>
                  {!isLast && (
                    <span className="mt-1 w-px flex-1 bg-slate-100" />
                  )}
                </div>

                {/* 内容 */}
                <div className={`flex-1 ${isLast ? "" : "pb-4"}`}>
                  <p className="text-sm font-medium text-slate-800">
                    {activity.title}
                  </p>
                  {activity.description && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {activity.description}
                    </p>
                  )}
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-400">
                    <Icon name="clock" className="h-3 w-3" />
                    {formatRelativeTime(activity.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
