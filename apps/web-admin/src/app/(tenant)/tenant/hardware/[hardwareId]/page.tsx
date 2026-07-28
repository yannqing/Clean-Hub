import { notFound } from "next/navigation";

import { getBranchListQuery } from "@/features/tenant/branches/queries";
import { HardwareFormView } from "@/features/tenant/hardware/components";
import {
  getDeviceDetailQuery,
} from "@/features/tenant/hardware/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

type EditHardwarePageProps = {
  params: Promise<{
    hardwareId: string;
  }>;
};

export default async function EditHardwarePage({
  params,
}: EditHardwarePageProps) {
  const { hardwareId } = await params;

  if (!ULID_PATTERN.test(hardwareId)) {
    notFound();
  }

  const requestOptions = await getTenantServerApiRequestOptions();
  const [device, branchResult] = await Promise.all([
    getDeviceDetailQuery(hardwareId, requestOptions),
    getBranchListQuery({}, requestOptions).then(
      (branches) => ({ branches, branchLoadFailed: false }),
      () => ({ branches: [], branchLoadFailed: true }),
    ),
  ]);

  if (!device) {
    notFound();
  }

  return (
    <HardwareFormView
      branches={branchResult.branches}
      branchLoadFailed={branchResult.branchLoadFailed}
      initialDevice={device}
      mode="edit"
    />
  );
}
