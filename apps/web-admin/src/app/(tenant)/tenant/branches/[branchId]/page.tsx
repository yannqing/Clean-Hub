import { BranchDetailView } from "@/features/tenant/branches";

type BranchDetailPageProps = {
  params: Promise<{
    branchId: string;
  }>;
};

export default async function BranchDetailPage({
  params,
}: BranchDetailPageProps) {
  const { branchId } = await params;

  return <BranchDetailView branchId={branchId} />;
}
