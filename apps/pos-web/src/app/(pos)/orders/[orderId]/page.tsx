import { notFound } from "next/navigation";
import { ApiHttpError } from "@cleanhub/api-client";

import { OrderDetailView } from "@/features/orders/components";
import {
  getOrderDetailQuery,
  getOrderPaymentAdjustmentsQuery,
  getOrderPaymentsQuery,
} from "@/features/orders/queries";
import { getPosCatalogQuery } from "@/features/catalog/queries";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentShiftQuery } from "@/features/shift-handover/queries";

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
  const currentShiftPromise = getCurrentShiftQuery().catch(() => null);

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

  const [user, catalog, currentShift] = await Promise.all([
    userPromise,
    getPosCatalogQuery({ branchId: order.branchId }).catch(() => ({
      data: [],
      products: [],
    })),
    currentShiftPromise,
  ]);

  return (
    <OrderDetailView
      adjustments={adjustments.data}
      canResolveManualPayments={
        user?.role === "owner" || user?.role === "manager"
      }
      catalog={catalog.data}
      currentShift={currentShift}
      order={order}
      payments={payments.data}
      products={catalog.products}
      source={source}
    />
  );
}
