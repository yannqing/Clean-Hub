import { HardwareFormView } from "@/features/tenant/hardware/components";
import { getPointOfSaleDevicesQuery } from "@/features/tenant/point-of-sale/queries";

export default async function NewPointOfSaleHardwarePage() {
  const terminalResult = await getPointOfSaleDevicesQuery({ limit: 100 }).then(
    (result) => ({ terminals: result.data, terminalLoadFailed: false }),
    () => ({ terminals: [], terminalLoadFailed: true }),
  );

  return (
    <HardwareFormView
      terminalLoadFailed={terminalResult.terminalLoadFailed}
      terminals={terminalResult.terminals}
    />
  );
}
