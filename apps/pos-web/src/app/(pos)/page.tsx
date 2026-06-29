import { BranchCard } from "@/features/branches/components";
import { getMyBranchQuery } from "@/features/branches/queries";
import { TicketMetrics } from "@/features/tickets/components/ticket-metrics";
import { getTicketOverviewQuery } from "@/features/tickets/queries/get-ticket-overview.query";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import { posRoutes } from "@/config/routes";

const ROLE_LABELS: Record<string, string> = {
  owner: "店主",
  manager: "店长",
  cashier: "收银员",
};

export default async function WorkspacePage() {
  // Parallel data fetch — all are independent server queries.
  const [user, branch, ticketOverview] = await Promise.all([
    getCurrentUser(),
    getMyBranchQuery(),
    getTicketOverviewQuery({}),
  ]);

  const roleLabel = user ? (ROLE_LABELS[user.role] ?? user.role) : null;

  return (
    <div className="space-y-6">
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

      {branch ? (
        <BranchCard branch={branch} />
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-700">
            尚未绑定门店
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            当前账号未分配到任何门店分店，请联系店主或店长在后台分配门店后再使用 POS。
          </p>
        </section>
      )}

      {/* 工单统计卡片 */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          今日工单概况
        </h2>
        <TicketMetrics overview={ticketOverview} />
      </section>

      {/* 快速操作区域 */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          快速操作
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            href={posRoutes.newIntake}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:border-blue-300 hover:bg-blue-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </span>
            <span className="text-xs font-medium text-slate-700">新建工单</span>
          </Link>

          <Link
            href={posRoutes.customers}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:border-green-300 hover:bg-green-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </span>
            <span className="text-xs font-medium text-slate-700">客户管理</span>
          </Link>

          <Link
            href={posRoutes.tickets}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:border-purple-300 hover:bg-purple-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </span>
            <span className="text-xs font-medium text-slate-700">工单管理</span>
          </Link>

          <Link
            href={posRoutes.orders}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition hover:border-orange-300 hover:bg-orange-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </span>
            <span className="text-xs font-medium text-slate-700">订单管理</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
