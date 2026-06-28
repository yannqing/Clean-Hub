import {
  buildDeliveryLabelText,
  buildDeliveryReceiptText,
  type DeliveryPrintTask,
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

export function validateDeliveryPrintTask(task: DeliveryTaskDetail): string | null {
  if (!task.id || !task.customerName || !task.address) {
    return "La tache ne contient pas les informations indispensables.";
  }

  if (!task.orderId && !task.ticketId) {
    return "Ajoutez une commande ou un ticket avant impression.";
  }

  return null;
}

export async function connectPortablePrinter(): Promise<DeliveryPrinterState> {
  return {
    status: "unavailable",
    device: null,
    error:
      "Connexion Bluetooth indisponible dans cette vue web. Utilisez l'application native apres synchronisation Capacitor.",
  };
}

export async function printDeliveryDocument(input: {
  task: DeliveryTaskDetail;
  document: DeliveryPrintDocument;
  printer: DeliveryPrinterState;
}): Promise<{ message: string }> {
  const validationError = validateDeliveryPrintTask(input.task);

  if (validationError) {
    throw new Error(validationError);
  }

  if (!input.printer.device) {
    throw new Error("Connectez une imprimante portable avant d'imprimer.");
  }

  const printable = toDeliveryPrintTask(input.task);
  const content =
    input.document === "label"
      ? buildDeliveryLabelText(printable, { locale: "fr" })
      : buildDeliveryReceiptText(printable, { locale: "fr" });

  openBrowserPrintPreview(content, input.document);

  return {
    message:
      input.document === "label"
        ? "Etiquette preparee pour impression."
        : "Recu prepare pour impression.",
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

function openBrowserPrintPreview(content: string, document: DeliveryPrintDocument): void {
  const popup = window.open("", "_blank", "noopener,noreferrer,width=420,height=720");

  if (!popup) {
    throw new Error("La fenetre d'impression a ete bloquee.");
  }

  popup.document.write(`<!doctype html>
<html lang="fr">
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
