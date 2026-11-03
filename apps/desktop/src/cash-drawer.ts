import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createEscPosPrinterCashDrawerAdapter,
  PosHardwareUnavailableError,
  type PosCashDrawerAdapter,
  type PosPrinterDevice,
  type PosRawPrinterWriteRequest,
} from "@cleanhub/hardware";

type CommandRunner = (command: string, args: string[]) => Promise<void>;

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { killSignal: "SIGKILL", timeout: 10_000, windowsHide: true },
      (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      },
    );
  });
}

function isCommandMissing(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return (error as { code?: unknown }).code === "ENOENT";
}

export function supportsCupsRawPrinting(platform: NodeJS.Platform): boolean {
  return platform === "darwin" || platform === "linux";
}

/** Submit bytes as a raw CUPS job without invoking a shell. */
export async function submitCupsRawPrintJob(
  request: PosRawPrinterWriteRequest,
  options: {
    platform?: NodeJS.Platform;
    run?: CommandRunner;
    temporaryDirectory?: string;
  } = {},
): Promise<void> {
  const platform = options.platform ?? process.platform;
  if (!supportsCupsRawPrinting(platform)) {
    throw new PosHardwareUnavailableError(
      "cashDrawer",
      "Raw cash-drawer pulses are supported through CUPS on macOS and Linux; this Windows terminal requires a vendor drawer driver.",
    );
  }

  const temporaryRoot = await mkdtemp(
    path.join(options.temporaryDirectory ?? os.tmpdir(), "cleanhub-drawer-"),
  );
  const pulsePath = path.join(temporaryRoot, "drawer-pulse.bin");
  const execute = options.run ?? runCommand;

  try {
    await writeFile(pulsePath, request.bytes, { mode: 0o600 });
    try {
      await execute("lp", ["-d", request.printerId, "-o", "raw", pulsePath]);
    } catch (error) {
      if (!isCommandMissing(error)) {
        throw error;
      }
      await execute("lpr", ["-P", request.printerId, "-l", pulsePath]);
    }
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

export function createDesktopCashDrawerAdapter(input: {
  listPrinters(): Promise<PosPrinterDevice[]>;
  platform?: NodeJS.Platform;
  writeRaw?(request: PosRawPrinterWriteRequest): Promise<void>;
}): PosCashDrawerAdapter {
  const platform = input.platform ?? process.platform;

  return createEscPosPrinterCashDrawerAdapter({
    isSupported: () => supportsCupsRawPrinting(platform),
    listPrinters: input.listPrinters,
    writeRaw: (request) =>
      input.writeRaw?.(request) ?? submitCupsRawPrintJob(request, { platform }),
  });
}
