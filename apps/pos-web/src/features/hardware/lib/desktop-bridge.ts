"use client";

import type {
  PosDrawerOpenRequest,
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

export type CleanHubDesktopBridge = {
  hardware: {
    getCapabilities(): Promise<PosHardwareCapabilities>;
    listPrinters(): Promise<PosPrinterDevice[]>;
    print(request: PosPrintRequest): Promise<PosPrintResult>;
    openCashDrawer(request: PosDrawerOpenRequest): Promise<void>;
    onScan(listener: (event: PosScanEvent) => void): () => void;
  };
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
