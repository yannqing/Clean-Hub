import { getMyBranchQuery } from "@/features/branches/queries";
import { CatalogView } from "@/features/catalog/components";
import { getPosCatalogQuery } from "@/features/catalog/queries";
import { getCurrentUser } from "@/lib/auth";

type CatalogPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getQueryParam(
  params: Record<string, string | string[] | undefined>,
): string {
  const raw = params.q;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.trim() ?? "";
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const query = getQueryParam(params);
  const [branch, user] = await Promise.all([
    getMyBranchQuery().catch(() => null),
    getCurrentUser(),
  ]);
  const branchId = user?.terminalBranchId ?? branch?.id;
  const catalog = branchId
    ? await getPosCatalogQuery({
        branchId,
        includeAll: true,
        q: query || undefined,
      })
    : { data: [], products: [] };

  return (
    <CatalogView
      branchName={branch?.name ?? "—"}
      key={query}
      products={catalog.products}
      query={query}
      services={catalog.data}
    />
  );
}
