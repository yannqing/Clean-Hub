import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  type IpcMainInvokeEvent,
  type WebContentsPrintOptions,
} from "electron";

import {
  createPosHardwareRuntime,
  createUnavailablePosScannerAdapter,
  type PosPrinterAdapter,
  type PosDrawerOpenRequest,
  type PosHardwareCapabilities,
  type PosPrintRequest,
  type PosPrintResult,
} from "@cleanhub/hardware";

import { desktopIpcChannels } from "./bridge.js";
import { createDesktopCashDrawerAdapter } from "./cash-drawer.js";
import {
  createDesktopOfflineStorage,
  type DesktopOfflineStorage,
} from "./offline-storage.js";
import { isUrlFromPosOrigin, resolvePosOrigin } from "./pos-origin.js";
import { acquireDesktopSingleInstance } from "./single-instance.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const posOriginConfig = resolvePosOrigin(process.env.CLEANHUB_POS_URL, {
  isProduction: app.isPackaged || process.env.NODE_ENV === "production",
});
const credentialFileName = "terminal-credential.bin";
const offlineStorageDirectoryName = "offline-queue";

let mainWindow: BrowserWindow | null = null;
let offlineStorage: DesktopOfflineStorage | null = null;
const ownsSingleInstance = acquireDesktopSingleInstance({
  requestLock: () => app.requestSingleInstanceLock(),
  quit: () => app.quit(),
  onSecondInstance: (listener) => app.on("second-instance", listener),
  getMainWindow: () => mainWindow,
});

function getCredentialPath(): string {
  return path.join(app.getPath("userData"), credentialFileName);
}

async function readTerminalCredential(): Promise<string | null> {
  try {
    const encrypted = await readFile(getCredentialPath());
    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }
    return safeStorage.decryptString(encrypted);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeTerminalCredential(credential: string): Promise<void> {
  const value = credential.trim();
  if (!value) {
    throw new Error("Terminal credential cannot be empty.");
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure credential storage is unavailable on this device.");
  }

  const credentialPath = getCredentialPath();
  await mkdir(path.dirname(credentialPath), { recursive: true });
  await writeFile(credentialPath, safeStorage.encryptString(value), {
    mode: 0o600,
  });
}

async function clearTerminalCredential(): Promise<void> {
  await rm(getCredentialPath(), { force: true });
}

function getOfflineStorage(): DesktopOfflineStorage {
  if (!offlineStorage) {
    throw new Error("Desktop offline storage is not initialized.");
  }
  return offlineStorage;
}

async function listPrinters() {
  const printers = await mainWindow?.webContents.getPrintersAsync();
  return (printers ?? []).map((printer) => {
    const options = printer.options as Record<string, string | undefined>;
    return {
      id: printer.name,
      name: printer.displayName || printer.name,
      isDefault:
        options.isDefault === "true" ||
        options["printer-is-default"] === "true",
    };
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function printText(request: PosPrintRequest): Promise<PosPrintResult> {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  try {
    const copies = Math.max(1, Math.min(10, Math.trunc(request.copies ?? 1)));
    const document = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(request.title ?? "CleanHub")}</title><style>body{margin:0;font:12px/1.35 monospace;white-space:pre-wrap}</style></head><body>${escapeHtml(request.content)}</body></html>`;
    await printWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(document)}`,
    );

    const options: WebContentsPrintOptions = {
      silent: true,
      printBackground: false,
      deviceName: request.printerId || undefined,
      copies,
    };
    await new Promise<void>((resolve, reject) => {
      printWindow.webContents.print(options, (success, failureReason) => {
        if (success) {
          resolve();
          return;
        }
        reject(new Error(failureReason || "Print job failed."));
      });
    });

    return { jobId: request.id, status: "printed" };
  } catch (error) {
    return {
      jobId: request.id,
      status: "failed",
      error: error instanceof Error ? error.message : "Print job failed.",
    };
  } finally {
    printWindow.destroy();
  }
}

const electronPrinterAdapter: PosPrinterAdapter = {
  async isAvailable() {
    return (await listPrinters()).length > 0;
  },
  listPrinters,
  print: printText,
};

const hardwareRuntime = createPosHardwareRuntime({
  scanner: createUnavailablePosScannerAdapter(
    "No native scanner adapter is configured; keyboard-wedge scanning remains available in POS Web.",
  ),
  printer: electronPrinterAdapter,
  cashDrawer: createDesktopCashDrawerAdapter({ listPrinters }),
  secureTerminalCredential: () => safeStorage.isEncryptionAvailable(),
});

function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  const trustedWindow = mainWindow;
  const senderFrame = event.senderFrame;

  if (
    !trustedWindow ||
    trustedWindow.isDestroyed() ||
    event.sender !== trustedWindow.webContents ||
    !senderFrame ||
    senderFrame !== event.sender.mainFrame ||
    !isUrlFromPosOrigin(event.sender.getURL(), posOriginConfig.origin) ||
    !isUrlFromPosOrigin(senderFrame.url, posOriginConfig.origin)
  ) {
    throw new Error("IPC request rejected from an untrusted POS renderer.");
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle(
    desktopIpcChannels.capabilities,
    async (event): Promise<PosHardwareCapabilities> => {
      assertTrustedIpcSender(event);
      return hardwareRuntime.getCapabilities();
    },
  );
  ipcMain.handle(desktopIpcChannels.printers, (event) => {
    assertTrustedIpcSender(event);
    return hardwareRuntime.listPrinters();
  });
  ipcMain.handle(
    desktopIpcChannels.print,
    (event, request: PosPrintRequest) => {
      assertTrustedIpcSender(event);
      return hardwareRuntime.print(request);
    },
  );
  ipcMain.handle(
    desktopIpcChannels.drawerOpen,
    (event, request: PosDrawerOpenRequest) => {
      assertTrustedIpcSender(event);
      return hardwareRuntime.openCashDrawer(request);
    },
  );
  ipcMain.handle(
    desktopIpcChannels.cardPayment,
    (event, request: import("@cleanhub/hardware").PosCardPaymentRequest) => {
      assertTrustedIpcSender(event);
      return hardwareRuntime.processCardPayment(request);
    },
  );
  ipcMain.handle(desktopIpcChannels.credentialGet, (event) => {
    assertTrustedIpcSender(event);
    return readTerminalCredential();
  });
  ipcMain.handle(
    desktopIpcChannels.credentialSet,
    (event, credential: string) => {
      assertTrustedIpcSender(event);
      return writeTerminalCredential(credential);
    },
  );
  ipcMain.handle(desktopIpcChannels.credentialClear, (event) => {
    assertTrustedIpcSender(event);
    return clearTerminalCredential();
  });
  ipcMain.handle(desktopIpcChannels.offlineGet, (event, key: string) => {
    assertTrustedIpcSender(event);
    return getOfflineStorage().getItem(key);
  });
  ipcMain.handle(
    desktopIpcChannels.offlineSet,
    (event, key: string, value: string) => {
      assertTrustedIpcSender(event);
      return getOfflineStorage().setItem(key, value);
    },
  );
  ipcMain.handle(desktopIpcChannels.offlineRemove, (event, key: string) => {
    assertTrustedIpcSender(event);
    return getOfflineStorage().removeItem(key);
  });
  ipcMain.handle(desktopIpcChannels.offlineKeys, (event) => {
    assertTrustedIpcSender(event);
    return getOfflineStorage().keys();
  });
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    backgroundColor: "#f7f9fc",
    webPreferences: {
      preload: path.join(currentDirectory, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const allowConfiguredPosNavigation = (
    event: Electron.Event,
    navigationUrl: string,
  ) => {
    if (!isUrlFromPosOrigin(navigationUrl, posOriginConfig.origin)) {
      event.preventDefault();
    }
  };

  window.webContents.on("will-navigate", allowConfiguredPosNavigation);
  window.webContents.on("will-redirect", allowConfiguredPosNavigation);
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.once("ready-to-show", () => window.show());
  void window.loadURL(posOriginConfig.url);
  return window;
}

if (ownsSingleInstance) {
  await app.whenReady();
  offlineStorage = createDesktopOfflineStorage(
    path.join(app.getPath("userData"), offlineStorageDirectoryName),
  );
  registerIpcHandlers();
  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
