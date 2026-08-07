import { isApiHttpError } from "@cleanhub/api-client";
import { notFound } from "next/navigation";

import {
  getTenantCustomerAccountCustomersQuery,
  getTenantCustomerAccountDetailQuery,
  TenantCustomerAccountDetailView,
} from "@/features/tenant/customers";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export default async function TenantCustomerAccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ edit?: string | string[] }>;
}) {
  const [{ accountId }, query] = await Promise.all([params, searchParams]);
  if (!ULID_PATTERN.test(accountId)) notFound();

  const requestOptions = await getTenantServerApiRequestOptions();
  const account = await getTenantCustomerAccountDetailQuery(
    accountId,
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
  const customers = await getTenantCustomerAccountCustomersQuery(
    account.id,
    { limit: 10, offset: 0 },
    requestOptions,
  );

  return (
    <TenantCustomerAccountDetailView
      initialAccount={account}
      initialCustomers={customers}
      initialEditing={query.edit === "1"}
    />
  );
}
