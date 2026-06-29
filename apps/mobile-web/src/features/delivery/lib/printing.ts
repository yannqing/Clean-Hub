import {
  buildDeliveryLabelText,
  buildDeliveryReceiptText,
  type DeliveryPrintTask,
  type PrintLocale,
  type PortablePrinterDevice,
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
  popupBlocked: string;
  readyLabel: string;
  readyReceipt: string;
  webUnavailable: string;
};

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
  messages: Pick<DeliveryPrintMessages, "webUnavailable">,
): Promise<DeliveryPrinterState> {
  return {
    status: "unavailable",
    device: null,
    error: messages.webUnavailable,
  };
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

  if (!input.printer.device) {
    throw new Error(input.messages.connectFirst);
  }

  const printable = toDeliveryPrintTask(input.task);
  const content =
    input.document === "label"
      ? buildDeliveryLabelText(printable, { locale: input.locale })
      : buildDeliveryReceiptText(printable, { locale: input.locale });

  openBrowserPrintPreview(content, input.document, input.locale, input.messages);

  return {
    message:
      input.document === "label"
        ? input.messages.readyLabel
        : input.messages.readyReceipt,
  };
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
