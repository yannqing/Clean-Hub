import { notFound } from "next/navigation";
import { ApiHttpError } from "@cleanhub/api-client";

import { OrderDetailView } from "@/features/orders/components";
import {
  getOrderDetailQuery,
  getOrderPaymentsQuery,
} from "@/features/orders/queries";

type OrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function OrderDetailPage({
  params,
}: OrderDetailPageProps) {
  const { orderId } = await params;
  let order: Awaited<ReturnType<typeof getOrderDetailQuery>>;
  let payments: Awaited<ReturnType<typeof getOrderPaymentsQuery>>;

  try {
    [order, payments] = await Promise.all([
      getOrderDetailQuery(orderId),
      getOrderPaymentsQuery(orderId),
    ]);
  } catch (error) {
    if (error instanceof ApiHttpError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return <OrderDetailView order={order} payments={payments.data} />;
}
