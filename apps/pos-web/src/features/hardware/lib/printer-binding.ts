import type { PosHardwareDeviceSummary } from "@cleanhub/api-client";
import type { PosPrinterDevice } from "@cleanhub/hardware";

export type PosConfiguredPrinter = {
  hardwareId: string;
  isDefault: boolean;
  logicalName: string;
  printerId: string;
  printerName: string;
};

export type PosPrinterBindingState =
  | "not_configured"
  | "not_bound"
  | "not_detected"
  | "connected";

function configString(
  config: Record<string, unknown>,
  key: string,
): string | null {
  const value = config[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getConfiguredPrinter(
  device: PosHardwareDeviceSummary,
): PosConfiguredPrinter | null {
  if (device.deviceType !== "printer" || device.status !== "active") {
    return null;
  }
  const printerId = configString(device.config, "printerId");
  if (!printerId) return null;

  return {
    hardwareId: device.id,
    isDefault: device.config.printerIsDefault === true,
    logicalName: device.name,
    printerId,
    printerName:
      configString(device.config, "printerName") ?? device.name,
  };
}

export function resolvePosPrinterBinding(input: {
  devices: PosHardwareDeviceSummary[];
  localPrinters: PosPrinterDevice[];
}): {
  state: PosPrinterBindingState;
  configured: PosConfiguredPrinter | null;
  localPrinter: PosPrinterDevice | null;
} {
  const logicalPrinters = input.devices
    .filter(
      (device) =>
        device.deviceType === "printer" &&
        device.status === "active" &&
        device.config.printerPurpose !== "label",
    )
    .sort(
      (left, right) =>
        Number(right.config.printerIsDefault === true) -
        Number(left.config.printerIsDefault === true),
    );
  if (logicalPrinters.length === 0) {
    return { state: "not_configured", configured: null, localPrinter: null };
  }

  const configuredPrinters = logicalPrinters
    .map(getConfiguredPrinter)
    .filter((printer): printer is PosConfiguredPrinter => printer !== null);
  if (configuredPrinters.length === 0) {
    return { state: "not_bound", configured: null, localPrinter: null };
  }

  for (const configured of configuredPrinters) {
    const localPrinter =
      input.localPrinters.find(
        (candidate) => candidate.id === configured.printerId,
      ) ?? null;
    if (localPrinter) {
      return { state: "connected", configured, localPrinter };
    }
  }

  return {
    state: "not_detected",
    configured: configuredPrinters[0] ?? null,
    localPrinter: null,
  };
}
