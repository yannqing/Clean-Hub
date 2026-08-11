import { isApiHttpError } from "@cleanhub/api-client";
import { notFound } from "next/navigation";

import { ServiceCreateView } from "@/features/tenant/services";
import {
  getServiceCategoryDatasetQuery,
  getServiceDetailQuery,
} from "@/features/tenant/services/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

type EditServicePageProps = {
  params: Promise<{
    serviceId: string;
  }>;
};

export default async function EditServicePage({
  params,
}: EditServicePageProps) {
  const { serviceId } = await params;

  if (!ULID_PATTERN.test(serviceId)) {
    notFound();
  }

  const requestOptions = await getTenantServerApiRequestOptions();
  const service = await getServiceDetailQuery(serviceId, requestOptions).catch(
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
  const [categoryResult] = await Promise.allSettled([
    getServiceCategoryDatasetQuery({}, requestOptions),
  ]);

  return (
    <ServiceCreateView
      categories={
        categoryResult.status === "fulfilled" ? categoryResult.value : []
      }
      categoriesLoadFailed={categoryResult.status === "rejected"}
      defaultCurrency={service.currency}
      initialService={service}
    />
  );
}
