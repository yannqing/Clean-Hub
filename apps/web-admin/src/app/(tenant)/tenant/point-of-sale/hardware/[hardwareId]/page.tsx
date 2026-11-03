import { notFound } from "next/navigation";

import { HardwareFormView } from "@/features/tenant/hardware/components";
import { getDeviceDetailQuery } from "@/features/tenant/hardware/queries";
import { getPointOfSaleDevicesQuery } from "@/features/tenant/point-of-sale/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

type EditPointOfSaleHardwarePageProps = {
  params: Promise<{ hardwareId: string }>;
};

export default async function EditPointOfSaleHardwarePage({
  params,
}: EditPointOfSaleHardwarePageProps) {
  const { hardwareId } = await params;
  if (!ULID_PATTERN.test(hardwareId)) notFound();

  const requestOptions = await getTenantServerApiRequestOptions();
  const [device, terminalResult] = await Promise.all([
    getDeviceDetailQuery(hardwareId, requestOptions),
    getPointOfSaleDevicesQuery({ limit: 100 }).then(
      (result) => ({ terminals: result.data, terminalLoadFailed: false }),
      () => ({ terminals: [], terminalLoadFailed: true }),
    ),
  ]);

  if (!device) notFound();

  return (
    <HardwareFormView
      initialDevice={device}
      mode="edit"
      terminalLoadFailed={terminalResult.terminalLoadFailed}
      terminals={terminalResult.terminals}
    />
  );
}
