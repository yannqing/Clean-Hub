import { isApiHttpError } from "@cleanhub/api-client";
import { notFound } from "next/navigation";

import { getBranchDetailQuery } from "@/features/tenant/branches/queries";
import {
  getTenantOrderDetailQuery,
  getTenantOrderTimelineQuery,
  TenantOrderDetailView,
} from "@/features/tenant/orders";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { getTenantUserListQuery } from "@/features/tenant/users/queries";
import { getServiceListQuery } from "@/features/tenant/services/queries";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

type TenantOrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function TenantOrderDetailPage({
  params,
}: TenantOrderDetailPageProps) {
  const { orderId } = await params;

  if (!ULID_PATTERN.test(orderId)) {
    notFound();
  }

  const requestOptions = await getTenantServerApiRequestOptions();
  const order = await getTenantOrderDetailQuery(orderId, requestOptions).catch(
    (error: unknown) => {
      if (
        isApiHttpError(error) &&
        (error.status === 403 || error.status === 404)
      ) {
        notFound();
      }

      throw error;
    },
  );
  const [branch, initialTimeline, staffMembers, services] = await Promise.all([
    getBranchDetailQuery(order.branchId, requestOptions).catch(() => null),
    getTenantOrderTimelineQuery(order.id, { limit: 20 }, requestOptions).catch(
      () => ({ data: [], nextCursor: null }),
    ),
    getTenantUserListQuery(
      { status: "active", limit: 100, offset: 0 },
      requestOptions,
    ).catch(() => []),
    getServiceListQuery({ status: "active" }, requestOptions).catch(() => []),
  ]);

  return (
    <TenantOrderDetailView
      branchName={branch?.name}
      initialTimeline={initialTimeline}
      order={order}
      services={services.filter(
        (service) => service.currency === order.currency,
      )}
      staffMembers={staffMembers}
    />
  );
}
