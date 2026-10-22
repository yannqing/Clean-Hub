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

type AndroidPosCapabilities = PosHardwareCapabilities & {
  connected: boolean;
  host: string;
  printerModel?: string;
  printerStatus?: string;
  printerStatusCode?: number;
  serviceVersion?: string;
};

type AndroidPosHardwarePlugin = {
  getCapabilities(): Promise<AndroidPosCapabilities>;
  listPrinters(): Promise<{ printers: PosPrinterDevice[] }>;
  discoverPrinters(): Promise<{ printers: PosPrinterDevice[] }>;
  pairPrinter(input: {
    printerId: string;
  }): Promise<{ printer: PosPrinterDevice }>;
  print(request: PosPrintRequest): Promise<PosPrintResult>;
  openCashDrawer(request: PosDrawerOpenRequest): Promise<void>;
  triggerScanner(): Promise<void>;
  addListener(
    eventName: "scan",
    listener: (event: PosScanEvent) => void,
  ): Promise<PluginListenerHandle>;
};

let nativePlugin: AndroidPosHardwarePlugin | null = null;

function getNativePlugin(): AndroidPosHardwarePlugin {
  nativePlugin ??= registerPlugin<AndroidPosHardwarePlugin>("T1101Hardware");
  return nativePlugin;
}

export function isAndroidPosNativeRuntime(input: {
  isNative: boolean;
  platform: string;
}): boolean {
  return input.isNative && input.platform === "android";
}

const androidPosHardwareBridge: PosHardwareBridge = {
  async getCapabilities() {
    return getNativePlugin().getCapabilities();
  },
  async listPrinters() {
    const result = await getNativePlugin().listPrinters();
    return result.printers;
  },
  async discoverPrinters() {
    const result = await getNativePlugin().discoverPrinters();
    return result.printers;
  },
  async pairPrinter(printerId) {
    const result = await getNativePlugin().pairPrinter({ printerId });
    return result.printer;
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
      "当前 Android POS 未提供经过收单认证的银行卡支付 SDK。",
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

export function getAndroidPosHardwareBridge(): PosHardwareBridge | null {
  if (typeof window === "undefined") return null;
  if (
    !isAndroidPosNativeRuntime({
      isNative: Capacitor.isNativePlatform(),
      platform: Capacitor.getPlatform(),
    })
  ) {
    return null;
  }
  return androidPosHardwareBridge;
}
