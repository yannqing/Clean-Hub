import { isApiHttpError } from "@cleanhub/api-client";
import { notFound } from "next/navigation";

import {
  DiscountFormView,
  DiscountLoadError,
  getDiscountDetailQuery,
  getDiscountOptionsQuery,
} from "@/features/tenant/discounts";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

type EditDiscountPageProps = {
  params: Promise<{ discountId: string }>;
};

export default async function EditDiscountPage({
  params,
}: EditDiscountPageProps) {
  const { discountId } = await params;

  if (!ULID_PATTERN.test(discountId)) notFound();

  const [discountResult, optionsResult] = await Promise.allSettled([
    getDiscountDetailQuery(discountId),
    getDiscountOptionsQuery(),
  ]);

  if (discountResult.status === "rejected") {
    if (
      isApiHttpError(discountResult.reason) &&
      (discountResult.reason.status === 403 ||
        discountResult.reason.status === 404)
    ) {
      notFound();
    }

    return <DiscountLoadError />;
  }

  if (optionsResult.status === "rejected") return <DiscountLoadError />;

  return (
    <DiscountFormView
      discountType={discountResult.value.type}
      initialDiscount={discountResult.value}
      mode="edit"
      options={optionsResult.value}
    />
  );
}
