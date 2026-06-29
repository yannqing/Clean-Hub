"use client";

import { useEffect, useState } from "react";
import type { PosRecentActivity } from "@cleanhub/api-client";
import { posApi } from "@/lib/api-client";

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  order: "订单",
  ticket: "工单",
  customer: "客户",
  payment: "支付",
};

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  order: "bg-blue-100 text-blue-600",
  ticket: "bg-purple-100 text-purple-600",
  customer: "bg-green-100 text-green-600",
  payment: "bg-orange-100 text-orange-600",
};

export function RecentActivities() {
  const [activities, setActivities] = useState<PosRecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await fetch("/api/workspace/recent-activities?limit=5");
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
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          最近活动
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">加载中...</p>
        </div>
      </section>
    );
  }

  if (activities.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          最近活动
        </h2>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="text-xs text-slate-500">暂无最近活动</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">最近活动</h2>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="space-y-3">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3"
            >
              <span
                className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  ACTIVITY_TYPE_COLORS[activity.type] ?? "bg-slate-100 text-slate-600"
                }`}
              >
                {ACTIVITY_TYPE_LABELS[activity.type]?.[0] ?? "?"}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">
                  {activity.title}
                </p>
                <p className="text-xs text-slate-500">{activity.description}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {new Date(activity.timestamp).toLocaleString("zh-CN")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
