import { StatisticsView } from "@/features/statistics/components/statistics-view";
import { getStatisticsOverviewQuery } from "@/features/statistics/queries";

export default async function StatisticsPage() {
  // 获取聚合统计数据（订单、工单、客户）
  const overview = await getStatisticsOverviewQuery({ period: "today" });

  return <StatisticsView overview={overview} />;
}
