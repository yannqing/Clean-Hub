import { notFound } from "next/navigation";
import { ApiHttpError } from "@cleanhub/api-client";

import { OrderDetailView } from "@/features/orders/components";
import {
  getOrderDetailQuery,
  getOrderPaymentAdjustmentsQuery,
  getOrderPaymentsQuery,
} from "@/features/orders/queries";
import { getPosCatalogQuery } from "@/features/orders/queries/get-pos-catalog.query";
import { getCurrentUser } from "@/lib/auth";

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
  let adjustments: Awaited<ReturnType<typeof getOrderPaymentAdjustmentsQuery>>;
  const userPromise = getCurrentUser();
  const catalogPromise = getPosCatalogQuery().catch(() => ({ data: [] }));

  try {
    [order, payments, adjustments] = await Promise.all([
      getOrderDetailQuery(orderId),
      getOrderPaymentsQuery(orderId),
      getOrderPaymentAdjustmentsQuery(orderId),
    ]);
  } catch (error) {
    if (error instanceof ApiHttpError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const [user, catalog] = await Promise.all([userPromise, catalogPromise]);

  return (
    <OrderDetailView
      adjustments={adjustments.data}
      canResolveManualPayments={
        user?.role === "owner" || user?.role === "manager"
      }
      catalog={catalog.data}
      order={order}
      payments={payments.data}
      source={source}
    />
  );
}
