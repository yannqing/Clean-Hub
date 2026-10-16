import type {
  PosBuiltInHardwareKey,
  PosHardwareDeviceType,
} from "@cleanhub/api-client";
import type {
  PosBuiltInHardwareDevice,
  PosHardwareCapabilities,
  PosPrinterDevice,
} from "@cleanhub/hardware";

import type { PosHardwareBridge } from "./desktop-bridge";

export type DiscoveredBuiltInHardware = {
  available: boolean;
  hardwareKey: PosBuiltInHardwareKey;
  name: string;
  deviceType: Extract<PosHardwareDeviceType, "printer" | "scanner">;
  localDeviceId: string;
  deviceModel?: string;
  printer?: PosPrinterDevice;
};

export type BuiltInHardwareInspection = {
  devices: DiscoveredBuiltInHardware[];
  hardwareModel: string | null;
  printerStatus: string | null;
};

const BUILT_IN_HARDWARE_KEY_PATTERN =
  /^[a-z0-9][a-z0-9._-]*:built-in:(printer|scanner)$/;

function normalizeBuiltInDevice(
  value: PosBuiltInHardwareDevice,
): DiscoveredBuiltInHardware | null {
  if (
    !BUILT_IN_HARDWARE_KEY_PATTERN.test(value.hardwareKey) ||
    !value.hardwareKey.endsWith(`:${value.deviceType}`) ||
    !value.name.trim() ||
    !value.localDeviceId.trim()
  ) {
    return null;
  }

  return {
    available: value.available === true,
    hardwareKey: value.hardwareKey as PosBuiltInHardwareKey,
    name: value.name.trim(),
    deviceType: value.deviceType,
    localDeviceId: value.localDeviceId.trim(),
    ...(value.deviceModel?.trim()
      ? { deviceModel: value.deviceModel.trim() }
      : {}),
  };
}

function inspectionFromCapabilities(
  capabilities: PosHardwareCapabilities,
): BuiltInHardwareInspection {
  const devices = (capabilities.builtInDevices ?? [])
    .map(normalizeBuiltInDevice)
    .filter((device): device is DiscoveredBuiltInHardware => device !== null);

  return {
    devices,
    hardwareModel: capabilities.hardwareModel?.trim() || null,
    printerStatus: capabilities.printerStatus ?? null,
  };
}

/**
 * Inspect peripherals built into the current machine without listing or
 * scanning external printers. Safe to run during terminal initialization.
 */
export async function inspectBuiltInHardware(
  hardware: PosHardwareBridge | null,
): Promise<BuiltInHardwareInspection> {
  if (!hardware) {
    return { devices: [], hardwareModel: null, printerStatus: null };
  }
  return inspectionFromCapabilities(await hardware.getCapabilities());
}

/**
 * Refresh the settings inventory. Unlike setup inspection, this also lists
 * local/paired printers so an enrolled terminal can test and bind them.
 */
export async function discoverBuiltInHardware(
  hardware: PosHardwareBridge | null,
): Promise<{
  devices: DiscoveredBuiltInHardware[];
  localPrinters: PosPrinterDevice[];
  printerStatus: string | null;
}> {
  if (!hardware) {
    return { devices: [], localPrinters: [], printerStatus: null };
  }

  const capabilities = await hardware.getCapabilities();
  const inspection = inspectionFromCapabilities(capabilities);
  let localPrinters: PosPrinterDevice[] = [];
  if (capabilities.printer) {
    try {
      localPrinters = await hardware.listPrinters();
    } catch {
      // Built-in inventory comes from the native adapter and remains usable
      // even when external-printer permissions or listing are unavailable.
    }
  }

  const devices = inspection.devices.map((device) => {
    if (device.deviceType !== "printer") return device;
    const printer =
      localPrinters.find(
        (candidate) => candidate.id === device.localDeviceId,
      ) ??
      (device.available
        ? {
            id: device.localDeviceId,
            name: device.name,
            isDefault: true,
            connectionType: "built_in" as const,
            isPaired: true,
          }
        : undefined);
    return { ...device, printer };
  });

  for (const device of devices) {
    if (
      device.deviceType === "printer" &&
      device.printer &&
      !localPrinters.some((printer) => printer.id === device.printer?.id)
    ) {
      localPrinters.unshift(device.printer);
    }
  }

  return {
    devices,
    localPrinters,
    printerStatus: inspection.printerStatus,
  };
}
