import { Suspense } from "react";
import type {
  PosOrderListQuery,
  PosOrderOverviewPeriod,
  PosOrderPaymentStatus,
  PosOrderStatus,
  PosOrderType,
} from "@cleanhub/api-client";

import {
  DEFAULT_ORDER_PAGE_SIZE,
  ORDER_FILTER_KEYS,
  type OrderDateFilter,
} from "@/features/orders/constants";
import {
  OrderMetrics,
  OrdersPageHeader,
  OrdersTable,
  OrdersToolbar,
} from "@/features/orders/components";
import { getMyBranchQuery } from "@/features/branches/queries";
import {
  getOrderOverviewQuery,
  getOrdersListQuery,
} from "@/features/orders/queries";

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function parsePageParam(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildDateRange(date: OrderDateFilter | undefined): {
  createdAfter?: string;
  createdBefore?: string;
} {
  if (!date || date === "all") {
    return {};
  }

  const now = new Date();
  const todayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  if (date === "today") {
    return {
      createdAfter: todayStart.toISOString(),
      createdBefore: new Date(
        todayStart.getTime() + 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
  }

  if (date === "last_7d") {
    return {
      createdAfter: new Date(
        todayStart.getTime() - 6 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    };
  }

  return {
    createdAfter: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    ).toISOString(),
  };
}

function buildOrderListQuery(
  params: Record<string, string | string[] | undefined>,
): PosOrderListQuery {
  const pageSize = parsePageParam(
    getParam(params, ORDER_FILTER_KEYS.pageSize),
    DEFAULT_ORDER_PAGE_SIZE,
  );
  const page = parsePageParam(getParam(params, ORDER_FILTER_KEYS.page), 1);
  const q = getParam(params, ORDER_FILTER_KEYS.q)?.trim() || undefined;
  const status = getParam(params, ORDER_FILTER_KEYS.status) as
    | PosOrderStatus
    | undefined;
  const paymentStatus = getParam(params, ORDER_FILTER_KEYS.paymentStatus) as
    | PosOrderPaymentStatus
    | undefined;
  const orderType = getParam(params, ORDER_FILTER_KEYS.orderType) as
    | PosOrderType
    | undefined;
  const date = getParam(params, ORDER_FILTER_KEYS.date) as
    | OrderDateFilter
    | undefined;

  return {
    q,
    status,
    paymentStatus,
    orderType,
    ...buildDateRange(date),
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

function buildOverviewPeriod(
  params: Record<string, string | string[] | undefined>,
): PosOrderOverviewPeriod {
  const date = getParam(params, ORDER_FILTER_KEYS.date) as
    | OrderDateFilter
    | undefined;

  if (date === "today") {
    return "today";
  }
  if (date === "last_7d") {
    return "week";
  }
  if (date === "month") {
    return "month";
  }
  return "all";
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const normalized = params as Record<string, string | string[] | undefined>;
  const query = buildOrderListQuery(normalized);
  const overviewPeriod = buildOverviewPeriod(normalized);

  const [list, overview, branch] = await Promise.all([
    getOrdersListQuery(query),
    getOrderOverviewQuery({ period: overviewPeriod }),
    getMyBranchQuery().catch(() => null),
  ]);

  return (
    <section>
      <OrdersPageHeader defaultBranchId={branch?.id} />

      <OrderMetrics overview={overview} />

      <Suspense fallback={null}>
        <OrdersToolbar totalCount={list.total} />
      </Suspense>

      <OrdersTable orders={list.data} total={list.total} />
    </section>
  );
}
