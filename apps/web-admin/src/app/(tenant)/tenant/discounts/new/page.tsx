import {
  DISCOUNT_TYPES,
  DiscountFormView,
  DiscountLoadError,
  DiscountTypePicker,
  getDiscountOptionsQuery,
  type DiscountType,
} from "@/features/tenant/discounts";

type NewDiscountPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewDiscountPage({
  searchParams,
}: NewDiscountPageProps) {
  const params = (await searchParams) ?? {};
  const rawType = Array.isArray(params.type) ? params.type[0] : params.type;
  const discountType = DISCOUNT_TYPES.includes(rawType as DiscountType)
    ? (rawType as DiscountType)
    : undefined;
  const options = await getDiscountOptionsQuery().catch(() => null);

  if (!options) return <DiscountLoadError />;

  if (!discountType) {
    return <DiscountTypePicker canManage={options.canManage} mode="page" />;
  }

  return <DiscountFormView discountType={discountType} options={options} />;
}
