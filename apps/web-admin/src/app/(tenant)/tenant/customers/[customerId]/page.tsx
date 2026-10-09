import { isApiHttpError } from "@cleanhub/api-client";
import { notFound } from "next/navigation";

import {
  getTenantCustomerDetailQuery,
  getTenantCustomerTimelineQuery,
  TenantCustomerDetailView,
} from "@/features/tenant/customers";
import { getTenantOrderListQuery } from "@/features/tenant/orders";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { getTenantUserListQuery } from "@/features/tenant/users/queries";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

type TenantCustomerDetailPageProps = {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{
    edit?: string | string[];
    sourceAccountId?: string | string[];
  }>;
};

export default async function TenantCustomerDetailPage({
  params,
  searchParams,
}: TenantCustomerDetailPageProps) {
  const [{ customerId }, query] = await Promise.all([params, searchParams]);

  if (!ULID_PATTERN.test(customerId)) {
    notFound();
  }

  const requestOptions = await getTenantServerApiRequestOptions();
  const customer = await getTenantCustomerDetailQuery(
    customerId,
    requestOptions,
  ).catch((error: unknown) => {
    if (
      isApiHttpError(error) &&
      (error.status === 403 || error.status === 404)
    ) {
      notFound();
    }

    throw error;
  });
  const [recentOrders, initialTimeline, staffMembers] = await Promise.all([
    getTenantOrderListQuery(
      {
        customerId: customer.id,
        limit: 10,
        offset: 0,
        sort: "created_desc",
      },
      requestOptions,
    ),
    getTenantCustomerTimelineQuery(
      customer.id,
      { limit: 20 },
      requestOptions,
    ).catch(() => ({ data: [], nextCursor: null })),
    getTenantUserListQuery(
      { status: "active", limit: 100, offset: 0 },
      requestOptions,
    ).catch(() => []),
  ]);

  return (
    <TenantCustomerDetailView
      customer={customer}
      fromAccountDetail={query.sourceAccountId === customer.account.id}
      initialEditing={query.edit === "1"}
      initialTimeline={initialTimeline}
      recentOrders={recentOrders.data}
      staffMembers={staffMembers}
      totalOrders={recentOrders.total}
    />
  );
}
