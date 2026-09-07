"use client";

import type {
  PosDrawerOpenRequest,
  PosCardPaymentRequest,
  PosCardPaymentResult,
  PosHardwareCapabilities,
  PosPrinterDevice,
  PosPrintRequest,
  PosPrintResult,
  PosScanEvent,
} from "@cleanhub/hardware";
import {
  createMemoryStorage,
  createWebStorageAdapter,
  type AsyncKeyValueStorage,
} from "@cleanhub/offline";

import { createPosIndexedDbStorage } from "./indexed-db-storage";
import { getT1101HardwareBridge } from "./t1101-bridge";

export type PosHardwareBridge = {
  getCapabilities(): Promise<PosHardwareCapabilities>;
  listPrinters(): Promise<PosPrinterDevice[]>;
  print(request: PosPrintRequest): Promise<PosPrintResult>;
  openCashDrawer(request: PosDrawerOpenRequest): Promise<void>;
  processCardPayment(request: PosCardPaymentRequest): Promise<PosCardPaymentResult>;
  onScan(listener: (event: PosScanEvent) => void): () => void;
  triggerScanner?(): Promise<void>;
};

export type CleanHubDesktopBridge = {
  hardware: PosHardwareBridge;
  terminalCredential: {
    get(): Promise<string | null>;
    set(credential: string): Promise<void>;
    clear(): Promise<void>;
  };
  offlineStorage: AsyncKeyValueStorage;
};

declare global {
  interface Window {
    cleanHubDesktop?: CleanHubDesktopBridge;
  }
}

export function getDesktopBridge(): CleanHubDesktopBridge | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.cleanHubDesktop ?? null;
}

/** Select the hardware host without conflating native Android with Electron. */
export function getPosHardwareBridge(): PosHardwareBridge | null {
  return getDesktopBridge()?.hardware ?? getT1101HardwareBridge();
}

let browserOfflineStorage: AsyncKeyValueStorage | null = null;

export function getPosOfflineStorage(): AsyncKeyValueStorage {
  const desktopStorage = getDesktopBridge()?.offlineStorage;
  if (desktopStorage) {
    return desktopStorage;
  }
  if (typeof window === "undefined") {
    return createMemoryStorage();
  }
  browserOfflineStorage ??= createPosIndexedDbStorage(
    createWebStorageAdapter(window.localStorage),
  );
  return browserOfflineStorage;
}
