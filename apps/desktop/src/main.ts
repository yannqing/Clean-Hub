import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  type WebContentsPrintOptions,
} from "electron";

import {
  createPosHardwareRuntime,
  createUnavailablePosCashDrawerAdapter,
  createUnavailablePosScannerAdapter,
  type PosPrinterAdapter,
  type PosDrawerOpenRequest,
  type PosHardwareCapabilities,
  type PosPrintRequest,
  type PosPrintResult,
} from "@cleanhub/hardware";

import { desktopIpcChannels } from "./bridge.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const posUrl = process.env.CLEANHUB_POS_URL ?? "http://localhost:3001";
const credentialFileName = "terminal-credential.bin";
const offlineStorageDirectoryName = "offline-queue";
const maxOfflineValueBytes = 5 * 1024 * 1024;

let mainWindow: BrowserWindow | null = null;

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

function getOfflineStoragePath(key: string): string {
  if (!key.startsWith("cleanhub.pos.offline.")) {
    throw new Error("Invalid offline storage key.");
  }
  const digest = createHash("sha256").update(key).digest("hex");
  return path.join(
    app.getPath("userData"),
    offlineStorageDirectoryName,
    `${digest}.json`,
  );
}

async function readOfflineValue(key: string): Promise<string | null> {
  try {
    return await readFile(getOfflineStoragePath(key), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function writeOfflineValue(key: string, value: string): Promise<void> {
  if (Buffer.byteLength(value, "utf8") > maxOfflineValueBytes) {
    throw new Error("Offline queue storage limit exceeded.");
  }
  const storagePath = getOfflineStoragePath(key);
  await mkdir(path.dirname(storagePath), { recursive: true });
  await writeFile(storagePath, value, { encoding: "utf8", mode: 0o600 });
}

async function removeOfflineValue(key: string): Promise<void> {
  await rm(getOfflineStoragePath(key), { force: true });
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
  cashDrawer: createUnavailablePosCashDrawerAdapter(
    "No cash-drawer adapter is configured for this terminal.",
  ),
  secureTerminalCredential: () => safeStorage.isEncryptionAvailable(),
});

function registerIpcHandlers(): void {
  ipcMain.handle(
    desktopIpcChannels.capabilities,
    async (): Promise<PosHardwareCapabilities> =>
      hardwareRuntime.getCapabilities(),
  );
  ipcMain.handle(desktopIpcChannels.printers, () =>
    hardwareRuntime.listPrinters(),
  );
  ipcMain.handle(
    desktopIpcChannels.print,
    (_event, request: PosPrintRequest) => hardwareRuntime.print(request),
  );
  ipcMain.handle(
    desktopIpcChannels.drawerOpen,
    (_event, request: PosDrawerOpenRequest) =>
      hardwareRuntime.openCashDrawer(request),
  );
  ipcMain.handle(desktopIpcChannels.credentialGet, readTerminalCredential);
  ipcMain.handle(
    desktopIpcChannels.credentialSet,
    (_event, credential: string) => writeTerminalCredential(credential),
  );
  ipcMain.handle(desktopIpcChannels.credentialClear, clearTerminalCredential);
  ipcMain.handle(
    desktopIpcChannels.offlineGet,
    (_event, key: string) => readOfflineValue(key),
  );
  ipcMain.handle(
    desktopIpcChannels.offlineSet,
    (_event, key: string, value: string) => writeOfflineValue(key, value),
  );
  ipcMain.handle(
    desktopIpcChannels.offlineRemove,
    (_event, key: string) => removeOfflineValue(key),
  );
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

  window.once("ready-to-show", () => window.show());
  void window.loadURL(posUrl);
  return window;
}

await app.whenReady();
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
