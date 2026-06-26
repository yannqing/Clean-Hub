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

  try {
    const [order, payments] = await Promise.all([
      getOrderDetailQuery(orderId),
      getOrderPaymentsQuery(orderId),
    ]);

    return <OrderDetailView order={order} payments={payments.data} />;
  } catch (error) {
    if (error instanceof ApiHttpError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
