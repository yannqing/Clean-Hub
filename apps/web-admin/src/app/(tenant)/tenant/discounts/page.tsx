import {
  DISCOUNT_METHODS,
  DISCOUNT_PAGE_SIZE,
  DISCOUNT_SORTS,
  DISCOUNT_STATUSES,
  DISCOUNT_TYPES,
  DiscountListView,
  getDiscountListQuery,
  getDiscountListOptionsQuery,
  type DiscountDerivedStatus,
  type DiscountMethod,
  type DiscountType,
  type TenantDiscountListQuery,
  type TenantDiscountSort,
} from "@/features/tenant/discounts";

type DiscountsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function stringParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function offsetParam(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export default async function DiscountsPage({
  searchParams,
}: DiscountsPageProps) {
  const params = (await searchParams) ?? {};
  const statusValue = stringParam(params, "status");
  const methodValue = stringParam(params, "method");
  const typeValue = stringParam(params, "type");
  const sortValue = stringParam(params, "sort");
  const query: TenantDiscountListQuery = {
    q: stringParam(params, "q"),
    status: DISCOUNT_STATUSES.includes(statusValue as DiscountDerivedStatus)
      ? (statusValue as DiscountDerivedStatus)
      : undefined,
    method: DISCOUNT_METHODS.includes(methodValue as DiscountMethod)
      ? (methodValue as DiscountMethod)
      : undefined,
    type: DISCOUNT_TYPES.includes(typeValue as DiscountType)
      ? (typeValue as DiscountType)
      : undefined,
    branchId: stringParam(params, "branchId"),
    sort: DISCOUNT_SORTS.includes(sortValue as TenantDiscountSort)
      ? (sortValue as TenantDiscountSort)
      : "created_desc",
    limit: DISCOUNT_PAGE_SIZE,
    offset: offsetParam(stringParam(params, "offset")),
  };
  const [listResult, optionsResult] = await Promise.allSettled([
    getDiscountListQuery(query),
    getDiscountListOptionsQuery(),
  ]);

  return (
    <DiscountListView
      key={query.q ?? ""}
      error={
        listResult.status === "rejected"
          ? listResult.reason instanceof Error
            ? listResult.reason.message
            : "Discounts failed to load."
          : undefined
      }
      options={
        optionsResult.status === "fulfilled" ? optionsResult.value : undefined
      }
      optionsError={
        optionsResult.status === "rejected"
          ? optionsResult.reason instanceof Error
            ? optionsResult.reason.message
            : "Discount options failed to load."
          : undefined
      }
      query={query}
      result={listResult.status === "fulfilled" ? listResult.value : undefined}
    />
  );
}
