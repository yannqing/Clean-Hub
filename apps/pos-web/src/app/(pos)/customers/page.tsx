import { CustomersView } from "@/features/customers";

type CustomersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
  const params = await searchParams;
  const initialQuery = getParam(params, "q")?.trim() ?? "";

  return <CustomersView initialQuery={initialQuery} key={initialQuery} />;
}
