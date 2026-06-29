"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PosPendingTask } from "@cleanhub/api-client";

const TASK_TYPE_LABELS: Record<string, string> = {
  overdue_ticket: "逾期工单",
  unpaid_order: "待收款订单",
  pending_pickup: "待取件工单",
};

const TASK_PRIORITY_COLORS: Record<string, string> = {
  high: "border-red-200 bg-red-50",
  medium: "border-orange-200 bg-orange-50",
  low: "border-blue-200 bg-blue-50",
};

const TASK_PRIORITY_BADGES: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-orange-100 text-orange-700",
  low: "bg-blue-100 text-blue-700",
};

export function PendingTasks() {
  const [tasks, setTasks] = useState<PosPendingTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await fetch("/api/workspace/pending-tasks");
        if (response.ok) {
          const data = await response.json();
          setTasks(data.tasks);
        }
      } catch (error) {
        console.error("Failed to fetch pending tasks:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  if (loading) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          待办任务
        </h2>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">加载中...</p>
        </div>
      </section>
    );
  }

  if (tasks.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">
          待办任务
        </h2>
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="text-xs text-slate-500">暂无待办任务</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-slate-700">待办任务</h2>
      <div className="space-y-3">
        {tasks.map((task) => (
          <Link
            key={task.id}
            href={task.actionRoute}
            className={`block rounded-xl border p-4 transition hover:shadow-sm ${
              TASK_PRIORITY_COLORS[task.priority] ?? "border-slate-200 bg-white"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  {task.title}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {task.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    TASK_PRIORITY_BADGES[task.priority] ?? "bg-slate-100 text-slate-600"
                  }`}
                >
                  {task.count}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
