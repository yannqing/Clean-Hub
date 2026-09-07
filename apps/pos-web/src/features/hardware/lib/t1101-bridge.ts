"use client";

import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";
import type {
  PosDrawerOpenRequest,
  PosHardwareCapabilities,
  PosPrinterDevice,
  PosPrintRequest,
  PosPrintResult,
  PosScanEvent,
} from "@cleanhub/hardware";
import { PosHardwareUnavailableError } from "@cleanhub/hardware";

import type { PosHardwareBridge } from "./desktop-bridge";

type T1101Capabilities = PosHardwareCapabilities & {
  connected: boolean;
  host: "pos-t1101";
  printerModel?: string;
  printerStatus?: string;
  printerStatusCode?: number;
  serviceVersion?: string;
};

type T1101HardwarePlugin = {
  getCapabilities(): Promise<T1101Capabilities>;
  listPrinters(): Promise<{ printers: PosPrinterDevice[] }>;
  print(request: PosPrintRequest): Promise<PosPrintResult>;
  openCashDrawer(request: PosDrawerOpenRequest): Promise<void>;
  triggerScanner(): Promise<void>;
  addListener(
    eventName: "scan",
    listener: (event: PosScanEvent) => void,
  ): Promise<PluginListenerHandle>;
};

let nativePlugin: T1101HardwarePlugin | null = null;

function getNativePlugin(): T1101HardwarePlugin {
  nativePlugin ??= registerPlugin<T1101HardwarePlugin>("T1101Hardware");
  return nativePlugin;
}

export function isT1101NativeRuntime(input: {
  isNative: boolean;
  platform: string;
}): boolean {
  return input.isNative && input.platform === "android";
}

const t1101HardwareBridge: PosHardwareBridge = {
  async getCapabilities() {
    return getNativePlugin().getCapabilities();
  },
  async listPrinters() {
    const result = await getNativePlugin().listPrinters();
    return result.printers;
  },
  async print(request) {
    return getNativePlugin().print(request);
  },
  async openCashDrawer(request) {
    await getNativePlugin().openCashDrawer(request);
  },
  async triggerScanner() {
    await getNativePlugin().triggerScanner();
  },
  async processCardPayment() {
    throw new PosHardwareUnavailableError(
      "cardTerminal",
      "POS-T1101 未提供经过收单认证的银行卡支付 SDK。",
    );
  },
  onScan(listener) {
    let disposed = false;
    const handle = getNativePlugin()
      .addListener("scan", listener)
      .catch(() => null);
    void handle.then((registered) => {
      if (disposed && registered) void registered.remove();
    });
    return () => {
      disposed = true;
      void handle.then((registered) => registered?.remove());
    };
  },
};

export function getT1101HardwareBridge(): PosHardwareBridge | null {
  if (typeof window === "undefined") return null;
  if (
    !isT1101NativeRuntime({
      isNative: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
    })
  ) {
    return null;
  }
  return t1101HardwareBridge;
}
