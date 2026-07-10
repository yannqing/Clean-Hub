import { notFound } from "next/navigation";
import { ApiHttpError } from "@cleanhub/api-client";

import { OrderDetailView } from "@/features/orders/components";
import {
  getOrderDetailQuery,
  getOrderPaymentsQuery,
} from "@/features/orders/queries";

type OrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{
    from?: string;
    q?: string;
    ticketFrom?: string;
    ticketId?: string;
  }>;
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: OrderDetailPageProps) {
  const [{ orderId }, source] = await Promise.all([params, searchParams]);
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

  return (
    <OrderDetailView
      order={order}
      payments={payments.data}
      source={source}
    />
  );
}
