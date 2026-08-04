import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createPosHardwareRuntime,
  createUnavailablePosCashDrawerAdapter,
  createUnavailablePosScannerAdapter,
  type PosPrinterAdapter,
} from "@cleanhub/hardware";

import { desktopIpcChannels } from "./bridge.js";
import {
  createDesktopCashDrawerAdapter,
  submitCupsRawPrintJob,
} from "./cash-drawer.js";
import {
  createDesktopOfflineStorage,
  desktopOfflineStorageIndexFileName,
} from "./offline-storage.js";
import { isUrlFromPosOrigin, resolvePosOrigin } from "./pos-origin.js";
import {
  acquireDesktopSingleInstance,
  focusExistingDesktopWindow,
} from "./single-instance.js";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const channelNames = Object.values(desktopIpcChannels);
assert(
  new Set(channelNames).size === channelNames.length,
  "desktop IPC channels must be unique",
);

let quitCalled = false;
const secondInstance = {
  listener: null as (() => void) | null,
};
assert(
  !acquireDesktopSingleInstance({
    requestLock: () => false,
    quit: () => {
      quitCalled = true;
    },
    onSecondInstance: () => {
      throw new Error("a secondary process must not register listeners");
    },
    getMainWindow: () => null,
  }) && quitCalled,
  "a secondary desktop process must quit before touching POS state",
);

const windowActions: string[] = [];
const existingWindow = {
  isDestroyed: () => false,
  isMinimized: () => true,
  restore: () => windowActions.push("restore"),
  show: () => windowActions.push("show"),
  focus: () => windowActions.push("focus"),
};
assert(
  acquireDesktopSingleInstance({
    requestLock: () => true,
    quit: () => {
      throw new Error("the primary process must not quit");
    },
    onSecondInstance: (listener) => {
      secondInstance.listener = listener;
    },
    getMainWindow: () => existingWindow,
  }),
  "the primary desktop process must retain the single-instance lock",
);
assert(
  focusExistingDesktopWindow(null) === false,
  "focusing before the main window exists must be safe",
);
secondInstance.listener?.();
assert(
  windowActions.join(",") === "restore,show,focus",
  "a repeated launch must restore and focus the existing POS window",
);

const developmentOrigin = resolvePosOrigin(undefined, {
  isProduction: false,
});
assert(
  developmentOrigin.url === "http://localhost:3001",
  "development POS origin must have a safe local default",
);
assert(
  resolvePosOrigin("http://192.168.1.20:3001", {
    isProduction: false,
  }).origin === "http://192.168.1.20:3001",
  "development POS origin must allow LAN HTTP",
);
assert(
  resolvePosOrigin("https://pos.cleanhub.test", {
    isProduction: false,
  }).origin === "https://pos.cleanhub.test",
  "development POS origin must allow HTTPS",
);

for (const value of [
  "not a url",
  "file:///tmp/pos.html",
  "https://user:secret@pos.cleanhub.test",
  "https://pos.cleanhub.test/login",
  "https://pos.cleanhub.test/?next=/",
  "https://pos.cleanhub.test/#setup",
]) {
  let rejected = false;
  try {
    resolvePosOrigin(value, { isProduction: false });
  } catch {
    rejected = true;
  }
  assert(rejected, `invalid POS origin must be rejected: ${value}`);
}

for (const value of [
  undefined,
  "http://pos.cleanhub.test",
  "https://localhost:3001",
  "https://127.0.0.1:3001",
  "https://127.0.0.2:3001",
  "https://[::1]:3001",
  "https://pos.cleanhub.example.com",
  "https://pos.invalid",
  "https://pos.cleanhub.test",
]) {
  let rejected = false;
  try {
    resolvePosOrigin(value, { isProduction: true });
  } catch {
    rejected = true;
  }
  assert(
    rejected,
    `unsafe production POS origin must be rejected: ${String(value)}`,
  );
}

const productionOrigin = resolvePosOrigin("https://pos.cleanhub.com", {
  isProduction: true,
});
assert(
  productionOrigin.origin === "https://pos.cleanhub.com",
  "production POS origin must accept a non-placeholder HTTPS origin",
);
assert(
  isUrlFromPosOrigin(
    "https://pos.cleanhub.com/orders?status=open",
    productionOrigin.origin,
  ),
  "same-origin POS routes must remain navigable",
);
assert(
  !isUrlFromPosOrigin("https://evil.example/orders", productionOrigin.origin),
  "cross-origin navigation must be rejected",
);
assert(
  !isUrlFromPosOrigin(
    "https://pos.cleanhub.com.evil.example",
    productionOrigin.origin,
  ),
  "lookalike origins must be rejected",
);
assert(
  !isUrlFromPosOrigin("data:text/html,untrusted", productionOrigin.origin),
  "opaque origins must be rejected",
);

const offlineStorageDirectory = await mkdtemp(
  path.join(os.tmpdir(), "cleanhub-desktop-offline-"),
);
try {
  const firstStorage = createDesktopOfflineStorage(offlineStorageDirectory);
  const firstKey = "cleanhub.pos.offline.queue.test-first";
  const secondKey = "cleanhub.pos.offline.queue.test-second";

  await firstStorage.setItem(firstKey, "[1]");
  assert(
    (await firstStorage.keys()).join(",") === firstKey,
    "setItem must register an enumerable offline key",
  );

  await firstStorage.setItem(secondKey, "[2]");
  await firstStorage.removeItem(firstKey);
  assert(
    (await firstStorage.keys()).join(",") === secondKey,
    "removeItem must remove the offline key from the index",
  );

  const concurrentKeys = Array.from(
    { length: 32 },
    (_, index) => `cleanhub.pos.offline.queue.concurrent-${index}`,
  );
  const secondStorageInstance = createDesktopOfflineStorage(
    offlineStorageDirectory,
  );
  await Promise.all(
    concurrentKeys.map((key, index) =>
      (index % 2 === 0 ? firstStorage : secondStorageInstance).setItem(
        key,
        String(index),
      ),
    ),
  );
  const keysAfterConcurrentWrites = await firstStorage.keys();
  assert(
    concurrentKeys.every((key) => keysAfterConcurrentWrites.includes(key)),
    "concurrent storage instances must not lose indexed keys",
  );

  const restartedStorage = createDesktopOfflineStorage(offlineStorageDirectory);
  assert(
    (await restartedStorage.keys()).includes(secondKey),
    "a restarted desktop storage instance must load the persisted key index",
  );

  const legacyKey = "cleanhub.pos.offline.queue.legacy-unindexed";
  const legacyFileName = `${createHash("sha256")
    .update(legacyKey)
    .digest("hex")}.json`;
  await writeFile(
    path.join(offlineStorageDirectory, legacyFileName),
    '["legacy"]',
    "utf8",
  );
  assert(
    !(await restartedStorage.keys()).includes(legacyKey),
    "legacy hash-only values must not be guessed during enumeration",
  );
  assert(
    (await restartedStorage.getItem(legacyKey)) === '["legacy"]',
    "legacy hash-only values must remain readable when their exact key is known",
  );

  await writeFile(
    path.join(offlineStorageDirectory, desktopOfflineStorageIndexFileName),
    "{damaged",
    "utf8",
  );
  const storageAfterIndexDamage = createDesktopOfflineStorage(
    offlineStorageDirectory,
  );
  assert(
    (await storageAfterIndexDamage.keys()).length === 0,
    "a damaged key index must fail closed without enumerating guessed keys",
  );
  assert(
    (await storageAfterIndexDamage.getItem(secondKey)) === "[2]",
    "index damage must not delete directly addressable offline values",
  );

  const postDamageKey = "cleanhub.pos.offline.queue.post-damage";
  await storageAfterIndexDamage.setItem(postDamageKey, "[]");
  assert(
    (await storageAfterIndexDamage.keys()).join(",") === postDamageKey,
    "new writes must safely establish a fresh index after index damage",
  );
  assert(
    !(await readdir(offlineStorageDirectory)).some((fileName) =>
      fileName.endsWith(".tmp"),
    ),
    "atomic storage writes must not leave temporary files behind",
  );
} finally {
  await rm(offlineStorageDirectory, { force: true, recursive: true });
}

const printer: PosPrinterAdapter = {
  isAvailable: () => true,
  async listPrinters() {
    return [{ id: "printer_1", name: "Test Printer", isDefault: true }];
  },
  async print(request) {
    return { jobId: request.id, status: "printed" };
  },
};
const runtime = createPosHardwareRuntime({
  scanner: createUnavailablePosScannerAdapter(),
  printer,
  cashDrawer: createUnavailablePosCashDrawerAdapter(),
  secureTerminalCredential: () => true,
});
const capabilities = await runtime.getCapabilities();
assert(
  !capabilities.scanner,
  "unconfigured native scanner must be unavailable",
);
assert(capabilities.printer, "injected printer adapter must be available");
assert(!capabilities.cashDrawer, "unknown cash drawer must be unavailable");
assert(
  capabilities.secureTerminalCredential,
  "secure credential capability must be discovered",
);
assert(
  (await runtime.print({ id: "job_1", printerId: "printer_1", content: "x" }))
    .status === "printed",
  "desktop printer adapter must preserve job status",
);

const drawerWrites: Array<{ printerId: string; bytes: Uint8Array }> = [];
const desktopDrawer = createDesktopCashDrawerAdapter({
  platform: "darwin",
  async listPrinters() {
    return [{ id: "printer_1", name: "Test Printer", isDefault: true }];
  },
  async writeRaw(request) {
    drawerWrites.push(request);
  },
});
assert(await desktopDrawer.isAvailable(), "CUPS drawer must be available");
await desktopDrawer.open({
  reason: "Cash payment",
  trigger: { type: "cash_payment", paymentId: "payment_1" },
});
assert(
  drawerWrites[0]?.printerId === "printer_1" &&
    drawerWrites[0]?.bytes[0] === 0x1b,
  "desktop drawer must submit a raw ESC/POS pulse to the default printer",
);

const windowsDrawer = createDesktopCashDrawerAdapter({
  platform: "win32",
  listPrinters: async () => [
    { id: "printer_1", name: "Test Printer", isDefault: true },
  ],
});
assert(
  !(await windowsDrawer.isAvailable()),
  "Windows must safely report unavailable without a vendor raw driver",
);

const cupsTempRoot = await mkdtemp(
  path.join(os.tmpdir(), "cleanhub-cups-smoke-"),
);
const cupsCommands: Array<{ command: string; args: string[] }> = [];
try {
  await submitCupsRawPrintJob(
    {
      printerId: "printer_1",
      bytes: Uint8Array.from([0x1b, 0x70, 0, 60, 120]),
    },
    {
      platform: "linux",
      temporaryDirectory: cupsTempRoot,
      async run(command, args) {
        cupsCommands.push({ command, args });
        if (command === "lp") {
          const error = new Error("lp unavailable") as NodeJS.ErrnoException;
          error.code = "ENOENT";
          throw error;
        }
      },
    },
  );
  assert(
    cupsCommands.map((entry) => entry.command).join(",") === "lp,lpr",
    "CUPS raw output must safely fall back from lp to lpr only when lp is missing",
  );
  assert(
    cupsCommands[1]?.args.slice(0, 3).join(",") === "-P,printer_1,-l",
    "lpr fallback must address the selected printer without a shell",
  );
} finally {
  await rm(cupsTempRoot, { force: true, recursive: true });
}

console.log("desktop smoke ok");
