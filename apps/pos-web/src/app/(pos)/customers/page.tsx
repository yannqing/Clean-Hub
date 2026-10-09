import { CustomersView } from "@/features/customers";
import { getCurrentUser } from "@/lib/auth";

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
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);
  const initialQuery = getParam(params, "q")?.trim() ?? "";

  return (
    <CustomersView
      canDelete={user?.role === "owner" || user?.role === "manager"}
      initialQuery={initialQuery}
      key={initialQuery}
    />
  );
}
