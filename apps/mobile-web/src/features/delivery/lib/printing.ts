import {
  buildDeliveryLabelEscPos,
  buildDeliveryLabelText,
  buildDeliveryReceiptEscPos,
  buildDeliveryReceiptText,
  createPortablePrinterPrintJob,
  defaultEscPosPrinterProfile,
  getPortablePrinterErrorMessage,
  type DeliveryPrintTask,
  type PortablePrinter,
  type PortablePrinterDevice,
  type PrintLocale,
} from "@cleanhub/hardware";

import type { DeliveryTaskDetail } from "../types";

export type DeliveryPrintDocument = "receipt" | "label";

export type DeliveryPrinterConnectionState =
  | "idle"
  | "discovering"
  | "connected"
  | "unavailable";

export type DeliveryPrinterState = {
  status: DeliveryPrinterConnectionState;
  device: PortablePrinterDevice | null;
  error: string | null;
};

export const initialDeliveryPrinterState: DeliveryPrinterState = {
  status: "idle",
  device: null,
  error: null,
};

export type DeliveryPrintMessages = {
  connectFirst: string;
  missingDocument: string;
  missingInfo: string;
  noDeviceFound: string;
  popupBlocked: string;
  readyLabel: string;
  readyReceipt: string;
  webUnavailable: string;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, unknown>;
};

let nativePrinterInstance: PortablePrinter | null = null;

function getCapacitorGlobal(): CapacitorGlobal | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = window as Window & { Capacitor?: CapacitorGlobal };
  return candidate.Capacitor ?? null;
}

export function isNativePortablePrintingAvailable(): boolean {
  const capacitor = getCapacitorGlobal();

  if (!capacitor) {
    return false;
  }

  if (typeof capacitor.isNativePlatform === "function") {
    return capacitor.isNativePlatform();
  }

  return Boolean(capacitor.Plugins?.BluetoothLe);
}

async function getNativePortablePrinter(): Promise<PortablePrinter> {
  if (!nativePrinterInstance) {
    const { createCapacitorBlePortablePrinter } = await import("@cleanhub/mobile");
    nativePrinterInstance = createCapacitorBlePortablePrinter();
  }

  return nativePrinterInstance;
}

export function validateDeliveryPrintTask(
  task: DeliveryTaskDetail,
  messages: Pick<DeliveryPrintMessages, "missingDocument" | "missingInfo">,
): string | null {
  if (!task.id || !task.customerName || !task.address) {
    return messages.missingInfo;
  }

  if (!task.orderId && !task.ticketId) {
    return messages.missingDocument;
  }

  return null;
}

export async function connectPortablePrinter(
  messages: Pick<DeliveryPrintMessages, "noDeviceFound" | "webUnavailable">,
  onStateChange?: (state: DeliveryPrinterState) => void,
): Promise<DeliveryPrinterState> {
  if (!isNativePortablePrintingAvailable()) {
    return {
      status: "unavailable",
      device: null,
      error: messages.webUnavailable,
    };
  }

  try {
    const printer = await getNativePortablePrinter();

    onStateChange?.({ status: "discovering", device: null, error: null });

    const devices = await printer.discover({
      serviceUuids: [defaultEscPosPrinterProfile.serviceUuid],
    });
    const target = pickStrongestDevice(devices);

    if (!target) {
      return {
        status: "unavailable",
        device: null,
        error: messages.noDeviceFound,
      };
    }

    await printer.connect({ deviceId: target.id });

    return {
      status: "connected",
      device: target,
      error: null,
    };
  } catch (error) {
    return {
      status: "unavailable",
      device: null,
      error: getPortablePrinterErrorMessage(error),
    };
  }
}

export async function disconnectPortablePrinter(): Promise<DeliveryPrinterState> {
  if (nativePrinterInstance) {
    await nativePrinterInstance.disconnect();
  }

  return { ...initialDeliveryPrinterState };
}

export async function printDeliveryDocument(input: {
  task: DeliveryTaskDetail;
  document: DeliveryPrintDocument;
  locale: PrintLocale;
  messages: DeliveryPrintMessages;
  printer: DeliveryPrinterState;
}): Promise<{ message: string }> {
  const validationError = validateDeliveryPrintTask(input.task, input.messages);

  if (validationError) {
    throw new Error(validationError);
  }

  const printable = toDeliveryPrintTask(input.task);
  const readyMessage =
    input.document === "label"
      ? input.messages.readyLabel
      : input.messages.readyReceipt;

  if (!isNativePortablePrintingAvailable()) {
    const content =
      input.document === "label"
        ? buildDeliveryLabelText(printable, { locale: input.locale })
        : buildDeliveryReceiptText(printable, { locale: input.locale });

    openBrowserPrintPreview(content, input.document, input.locale, input.messages);

    return { message: readyMessage };
  }

  if (!input.printer.device) {
    throw new Error(input.messages.connectFirst);
  }

  const printer = await getNativePortablePrinter();
  const bytes =
    input.document === "label"
      ? buildDeliveryLabelEscPos(printable, { locale: input.locale })
      : buildDeliveryReceiptEscPos(printable, { locale: input.locale });

  await printer.print(
    createPortablePrinterPrintJob({
      id: `${input.document}-${input.task.id}-${Date.now()}`,
      printerId: input.printer.device.id,
      title: `CleanHub ${input.document}`,
      bytes,
    }),
  );

  return { message: readyMessage };
}

export function toDeliveryPrintTask(task: DeliveryTaskDetail): DeliveryPrintTask {
  return {
    taskId: task.id,
    kind: task.type === "pickup" ? "pickup" : "delivery",
    customer: {
      name: task.customerName,
      phone: task.customerPhone ?? undefined,
    },
    address: task.address,
    orderId: task.orderId ?? task.order?.id,
    workOrderId: task.ticket?.ticketNo ?? task.ticketId ?? undefined,
    scheduledAt: task.expectedAt ?? undefined,
    note: task.notes ?? undefined,
  };
}

function pickStrongestDevice(
  devices: PortablePrinterDevice[],
): PortablePrinterDevice | null {
  if (!devices.length) {
    return null;
  }

  return [...devices].sort(
    (first, second) =>
      (second.rssi ?? Number.NEGATIVE_INFINITY) -
      (first.rssi ?? Number.NEGATIVE_INFINITY),
  )[0];
}

function openBrowserPrintPreview(
  content: string,
  document: DeliveryPrintDocument,
  locale: PrintLocale,
  messages: Pick<DeliveryPrintMessages, "popupBlocked">,
): void {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=420,height=720");

  if (!popup) {
    throw new Error(messages.popupBlocked);
  }

  popup.document.write(`<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <title>CleanHub ${document}</title>
    <style>
      body { font: 14px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin: 16px; }
      pre { white-space: pre-wrap; word-break: break-word; }
    </style>
  </head>
  <body><pre>${escapeHtml(content)}</pre></body>
</html>`);
  popup.document.close();
  popup.focus();
  popup.print();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
