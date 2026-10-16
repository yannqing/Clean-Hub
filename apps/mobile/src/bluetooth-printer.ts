import {
  BleClient,
  type BleDevice,
  type ScanResult,
} from "@capacitor-community/bluetooth-le";
import {
  defaultEscPosPrinterProfile,
  getPortablePrinterErrorMessage,
  type PortablePrinter,
  type PortablePrinterConnectionOptions,
  type PortablePrinterDevice,
  type PortablePrinterDiscoveryOptions,
  type PortablePrinterPrintJob,
  type PortablePrinterStatus,
  type PortablePrinterWriteOptions,
} from "@cleanhub/hardware";

export type CapacitorBlePortablePrinterOptions = {
  defaultServiceUuid?: string;
  defaultCharacteristicUuid?: string;
  defaultChunkSize?: number;
  defaultDelayMsBetweenChunks?: number;
};

export class CapacitorBlePortablePrinter implements PortablePrinter {
  private readonly defaultServiceUuid: string;
  private readonly defaultCharacteristicUuid: string;
  private readonly defaultChunkSize: number;
  private readonly defaultDelayMsBetweenChunks: number;
  private status: PortablePrinterStatus = { state: "disconnected" };
  private connectedDeviceId?: string;
  private connectedServiceUuid?: string;
  private connectedCharacteristicUuid?: string;

  constructor(options: CapacitorBlePortablePrinterOptions = {}) {
    this.defaultServiceUuid =
      options.defaultServiceUuid ?? defaultEscPosPrinterProfile.serviceUuid;
    this.defaultCharacteristicUuid =
      options.defaultCharacteristicUuid ??
      defaultEscPosPrinterProfile.characteristicUuid;
    this.defaultChunkSize =
      options.defaultChunkSize ?? defaultEscPosPrinterProfile.chunkSize;
    this.defaultDelayMsBetweenChunks =
      options.defaultDelayMsBetweenChunks ??
      defaultEscPosPrinterProfile.delayMsBetweenChunks;
  }

  getStatus(): PortablePrinterStatus {
    return this.status;
  }

  private setStatus(status: PortablePrinterStatus): void {
    this.status = status;
  }

  async discover(
    options: PortablePrinterDiscoveryOptions = {},
  ): Promise<PortablePrinterDevice[]> {
    this.setStatus({ state: "discovering" });

    try {
      await BleClient.initialize();

      const results = new Map<string, ScanResult>();
      await BleClient.requestLEScan(
        {
          services: options.serviceUuids,
        },
        (result) => {
          if (matchesNamePrefix(result.device, options.namePrefix)) {
            results.set(result.device.deviceId, result);
          }
        },
      );

      await delay(options.timeoutMs ?? 5000);
      await BleClient.stopLEScan();

      const devices = Array.from(results.values()).map(scanResultToPrinterDevice);
      this.setStatus({ state: "disconnected" });
      return devices;
    } catch (error) {
      await stopScanQuietly();
      this.setStatus({
        state: "error",
        lastError: getPortablePrinterErrorMessage(error),
      });
      throw error;
    }
  }

  async connect(
    options: PortablePrinterConnectionOptions,
  ): Promise<PortablePrinterDevice> {
    this.setStatus({ state: "connecting" });

    try {
      await BleClient.initialize();
      await BleClient.connect(options.deviceId, () => {
        this.connectedDeviceId = undefined;
        this.setStatus({ state: "disconnected" });
      });

      this.connectedDeviceId = options.deviceId;
      this.connectedServiceUuid = options.serviceUuid ?? this.defaultServiceUuid;
      this.connectedCharacteristicUuid =
        options.characteristicUuid ?? this.defaultCharacteristicUuid;

      const device: PortablePrinterDevice = {
        id: options.deviceId,
        connection: "bluetooth",
      };

      this.setStatus({ state: "connected", device });
      return device;
    } catch (error) {
      this.setStatus({
        state: "error",
        lastError: getPortablePrinterErrorMessage(error),
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    const deviceId = this.connectedDeviceId;
    this.connectedDeviceId = undefined;

    if (deviceId) {
      await BleClient.disconnect(deviceId);
    }

    this.setStatus({ state: "disconnected" });
  }

  async print(
    job: PortablePrinterPrintJob,
    options: PortablePrinterWriteOptions = {},
  ): Promise<void> {
    if (!this.connectedDeviceId) {
      throw new Error("Connect a portable Bluetooth printer before printing.");
    }

    const serviceUuid = this.connectedServiceUuid ?? this.defaultServiceUuid;
    const characteristicUuid =
      this.connectedCharacteristicUuid ?? this.defaultCharacteristicUuid;
    const chunkSize = options.chunkSize ?? this.defaultChunkSize;
    const delayMs =
      options.delayMsBetweenChunks ?? this.defaultDelayMsBetweenChunks;
    const copies = job.copies ?? 1;

    this.setStatus({ ...this.status, state: "printing" });

    try {
      for (let copy = 0; copy < copies; copy += 1) {
        for (const chunk of chunkBytes(job.bytes, chunkSize)) {
          await BleClient.write(
            this.connectedDeviceId,
            serviceUuid,
            characteristicUuid,
            bytesToDataView(chunk),
          );

          if (delayMs > 0) {
            await delay(delayMs);
          }
        }
      }

      this.setStatus({ ...this.status, state: "connected" });
    } catch (error) {
      this.setStatus({
        ...this.status,
        state: "error",
        lastError: getPortablePrinterErrorMessage(error),
      });
      throw error;
    }
  }
}

export function createCapacitorBlePortablePrinter(
  options?: CapacitorBlePortablePrinterOptions,
): CapacitorBlePortablePrinter {
  return new CapacitorBlePortablePrinter(options);
}

function scanResultToPrinterDevice(result: ScanResult): PortablePrinterDevice {
  return {
    id: result.device.deviceId,
    name: result.device.name ?? result.localName,
    rssi: result.rssi,
    connection: "bluetooth",
    metadata: {
      uuids: result.uuids,
    },
  };
}

function matchesNamePrefix(device: BleDevice, namePrefix?: string): boolean {
  if (!namePrefix) {
    return true;
  }

  return (device.name ?? "").toLowerCase().startsWith(namePrefix.toLowerCase());
}

function chunkBytes(bytes: Uint8Array, chunkSize: number): Uint8Array[] {
  if (chunkSize <= 0) {
    return [bytes];
  }

  const chunks: Uint8Array[] = [];

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(bytes.slice(offset, offset + chunkSize));
  }

  return chunks;
}

function bytesToDataView(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function stopScanQuietly(): Promise<void> {
  try {
    await BleClient.stopLEScan();
  } catch {
    // Ignore cleanup failures after permission or adapter errors.
  }
}
