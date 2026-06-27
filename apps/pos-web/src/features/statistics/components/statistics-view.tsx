import { type ServiceTicketOverview } from "@cleanhub/api-client";
import { StatisticsCards } from "./statistics-cards";
import { TicketStatusChart } from "./ticket-status-chart";

type StatisticsViewProps = {
  ticketOverview: ServiceTicketOverview | null;
};

export function StatisticsView({ ticketOverview }: StatisticsViewProps) {
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          业务记录
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">统计数据</h1>
        <p className="mt-1 text-sm text-slate-500">
          查看门店经营数据：工单处理量、状态分布和运营指标。
        </p>
      </div>

      {/* 统计指标卡片 */}
      <section>
        <h2 className="mb-4 text-sm font-semibold text-slate-700">
          今日工单概况
        </h2>
        <StatisticsCards overview={ticketOverview} />
      </section>

      {/* 工单状态分布 */}
      <section>
        <TicketStatusChart overview={ticketOverview} />
      </section>

      {/* 数据说明 */}
      <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-700">数据说明</h3>
        <ul className="space-y-1 text-xs text-slate-500">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-slate-400">•</span>
            <span>进行中工单：包含待处理和处理中的工单</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-slate-400">•</span>
            <span>已逾期：超过预计取件时间的工单</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-slate-400">•</span>
            <span>今日新增：今日创建的新工单</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-slate-400">•</span>
            <span>今日完成：今日取件完成的工单</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
