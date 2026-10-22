import { webAdminApi } from "@/lib/api-client";

import type { ApiRequestOptions } from "@cleanhub/api-client";
import type {
  ServiceCategoryListFilters,
  ServiceCategorySummary,
} from "../types";

const SERVICE_CATEGORY_DATASET_CHUNK_SIZE = 100;

type ServiceCategoryRequestOptions = Omit<
  ApiRequestOptions,
  "method" | "body" | "query"
>;

export async function getServiceCategoryDatasetQuery(
  filters: ServiceCategoryListFilters = {},
  options: ServiceCategoryRequestOptions = {},
): Promise<ServiceCategorySummary[]> {
  const categories = new Map<string, ServiceCategorySummary>();
  let offset = 0;

  while (true) {
    const page = await webAdminApi.tenant.services.listCategories(
      {
        ...filters,
        limit: SERVICE_CATEGORY_DATASET_CHUNK_SIZE,
        offset,
      },
      options,
    );

    for (const category of page) {
      categories.set(category.id, category);
    }

    offset += page.length;

    if (page.length < SERVICE_CATEGORY_DATASET_CHUNK_SIZE) {
      break;
    }
  }

  return [...categories.values()].toSorted(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}
