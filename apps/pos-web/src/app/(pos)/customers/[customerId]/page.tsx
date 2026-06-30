import { CustomerDetailView } from "@/features/customers";

type CustomerDetailPageProps = {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ from?: string }>;
};

export default async function CustomerDetailPage({
  params,
  searchParams,
}: CustomerDetailPageProps) {
  const { customerId } = await params;
  const { from } = await searchParams;
  return (
    <CustomerDetailView customerId={customerId} from={from} />
  );
}
