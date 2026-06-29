import { StatisticsView } from "@/features/statistics/components/statistics-view";
import { getTicketOverviewQuery } from "@/features/statistics/queries";

export default async function StatisticsPage() {
  // 获取工单统计数据
  const ticketOverview = await getTicketOverviewQuery({});

  return <StatisticsView ticketOverview={ticketOverview} />;
}
