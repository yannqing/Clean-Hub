import { CustomerDetailView } from "@/features/customers";

type CustomerDetailPageProps = {
  params: Promise<{ customerId: string }>;
};

export default async function CustomerDetailPage({
  params,
}: CustomerDetailPageProps) {
  const { customerId } = await params;
  return <CustomerDetailView customerId={customerId} />;
}
