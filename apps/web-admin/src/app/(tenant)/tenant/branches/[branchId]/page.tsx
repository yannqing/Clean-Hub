import { PagePlaceholder } from "@/components/app-shell";

type BranchDetailPageProps = {
  params: Promise<{
    branchId: string;
  }>;
};

export default async function BranchDetailPage({
  params,
}: BranchDetailPageProps) {
  const { branchId } = await params;

  return (
    <PagePlaceholder
      description={`Branch detail placeholder for branch ${branchId}.`}
      items={["Profile", "Staff", "Hardware", "Service availability", "Reports"]}
      title="Branch Detail"
    />
  );
}
