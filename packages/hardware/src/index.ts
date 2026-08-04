export type PrinterConnection = "usb" | "bluetooth" | "wifi";

export type PrintJob = {
  id: string;
  printerId: string;
  content: string;
};

export type PosHardwareCapabilities = {
  scanner: boolean;
  printer: boolean;
  cashDrawer: boolean;
  secureTerminalCredential: boolean;
};

export type PosPrinterDevice = {
  id: string;
  name: string;
  isDefault: boolean;
};

export type PosPrintJobStatus = "pending" | "printing" | "printed" | "failed";

export type PosPrintRequest = PrintJob & {
  title?: string;
  copies?: number;
};

export type PosPrintResult = {
  jobId: string;
  status: PosPrintJobStatus;
  error?: string;
};

export type PosDrawerOpenRequest = {
  reason: string;
  printerId?: string;
  pulse?: PosCashDrawerPulse;
  trigger:
    | { type: "cash_payment"; paymentId: string }
    | { type: "manual"; authorizationId: string };
};

export type PosCashDrawerPulse = {
  /** ESC/POS connector pin: 0 = drawer pin 2, 1 = drawer pin 5. */
  pin?: 0 | 1;
  /** Energized duration in milliseconds. ESC/POS supports 2-510 ms. */
  onTimeMs?: number;
  /** Delay after the pulse in milliseconds. ESC/POS supports 2-510 ms. */
  offTimeMs?: number;
};

export type PosRawPrinterWriteRequest = {
  printerId: string;
  bytes: Uint8Array;
};

export type PosScanEvent = {
  value: string;
  symbology?: string;
  scannedAt: string;
};

export class PosHardwareUnavailableError extends Error {
  readonly code = "POS_HARDWARE_UNAVAILABLE";

  constructor(
    readonly capability: "scanner" | "printer" | "cashDrawer",
    message: string,
  ) {
    super(message);
    this.name = "PosHardwareUnavailableError";
  }
}

export type PosScannerAdapter = {
  isAvailable(): boolean | Promise<boolean>;
};

export type PosPrinterAdapter = {
  isAvailable(): boolean | Promise<boolean>;
  listPrinters(): Promise<PosPrinterDevice[]>;
  print(request: PosPrintRequest): Promise<PosPrintResult>;
};

export type PosCashDrawerAdapter = {
  isAvailable(): boolean | Promise<boolean>;
  open(request: PosDrawerOpenRequest): Promise<void>;
};

function requireDrawerRequest(request: PosDrawerOpenRequest): void {
  if (
    !request ||
    typeof request.reason !== "string" ||
    !request.reason.trim()
  ) {
    throw new Error("A reason is required to open the cash drawer.");
  }

  const trigger = request.trigger;
  const validCashPaymentTrigger =
    trigger?.type === "cash_payment" &&
    typeof trigger.paymentId === "string" &&
    Boolean(trigger.paymentId.trim());
  const validManualTrigger =
    trigger?.type === "manual" &&
    typeof trigger.authorizationId === "string" &&
    Boolean(trigger.authorizationId.trim());

  if (!validCashPaymentTrigger && !validManualTrigger) {
    throw new Error("An authorized cash-drawer trigger is required.");
  }

  if (
    request.printerId !== undefined &&
    (typeof request.printerId !== "string" || !request.printerId.trim())
  ) {
    throw new Error("Cash-drawer printer ID must be a non-empty string.");
  }
}

function toEscPosPulseUnit(
  value: number | undefined,
  fallback: number,
): number {
  const duration = value ?? fallback;
  if (!Number.isFinite(duration) || duration < 2 || duration > 510) {
    throw new Error("Cash-drawer pulse duration must be between 2 and 510 ms.");
  }
  return Math.max(1, Math.min(255, Math.round(duration / 2)));
}

/** Build the standard ESC/POS `ESC p m t1 t2` cash-drawer pulse command. */
export function buildEscPosCashDrawerPulse(
  pulse: PosCashDrawerPulse = {},
): Uint8Array {
  const pin = pulse.pin ?? 0;
  if (pin !== 0 && pin !== 1) {
    throw new Error("Cash-drawer pulse pin must be 0 or 1.");
  }

  return Uint8Array.from([
    0x1b,
    0x70,
    pin,
    toEscPosPulseUnit(pulse.onTimeMs, 120),
    toEscPosPulseUnit(pulse.offTimeMs, 240),
  ]);
}

/**
 * Cash-drawer adapter for drawers connected to an ESC/POS receipt printer.
 * The host supplies raw printer transport (for example CUPS on macOS/Linux).
 */
export function createEscPosPrinterCashDrawerAdapter(input: {
  isSupported(): boolean | Promise<boolean>;
  listPrinters(): Promise<PosPrinterDevice[]>;
  writeRaw(request: PosRawPrinterWriteRequest): Promise<void>;
}): PosCashDrawerAdapter {
  return {
    async isAvailable() {
      return (
        Boolean(await input.isSupported()) &&
        (await input.listPrinters()).length > 0
      );
    },
    async open(request) {
      requireDrawerRequest(request);

      if (!(await input.isSupported())) {
        throw new PosHardwareUnavailableError(
          "cashDrawer",
          "Raw ESC/POS cash-drawer output is unavailable on this operating system.",
        );
      }

      const printers = await input.listPrinters();
      const printer = request.printerId
        ? printers.find((candidate) => candidate.id === request.printerId)
        : (printers.find((candidate) => candidate.isDefault) ?? printers[0]);

      if (!printer) {
        throw new PosHardwareUnavailableError(
          "cashDrawer",
          request.printerId
            ? "The configured cash-drawer receipt printer was not found."
            : "No receipt printer is available for the cash drawer.",
        );
      }

      await input.writeRaw({
        printerId: printer.id,
        bytes: buildEscPosCashDrawerPulse(request.pulse),
      });
    },
  };
}

export type PosHardwareRuntime = {
  getCapabilities(): Promise<PosHardwareCapabilities>;
  listPrinters(): Promise<PosPrinterDevice[]>;
  print(request: PosPrintRequest): Promise<PosPrintResult>;
  openCashDrawer(request: PosDrawerOpenRequest): Promise<void>;
};

export function createUnavailablePosScannerAdapter(
  reason = "No scanner adapter is configured for this terminal.",
): PosScannerAdapter {
  void reason;
  return { isAvailable: () => false };
}

export function createUnavailablePosPrinterAdapter(
  reason = "No printer adapter is configured for this terminal.",
): PosPrinterAdapter {
  return {
    isAvailable: () => false,
    async listPrinters() {
      return [];
    },
    async print(request) {
      return {
        jobId: request.id,
        status: "failed",
        error: reason,
      };
    },
  };
}

export function createUnavailablePosCashDrawerAdapter(
  reason = "No cash-drawer adapter is configured for this terminal.",
): PosCashDrawerAdapter {
  return {
    isAvailable: () => false,
    async open(request) {
      requireDrawerRequest(request);
      throw new PosHardwareUnavailableError("cashDrawer", reason);
    },
  };
}

export function createPosHardwareRuntime(input: {
  scanner?: PosScannerAdapter;
  printer?: PosPrinterAdapter;
  cashDrawer?: PosCashDrawerAdapter;
  secureTerminalCredential(): boolean | Promise<boolean>;
}): PosHardwareRuntime {
  const scanner = input.scanner ?? createUnavailablePosScannerAdapter();
  const printer = input.printer ?? createUnavailablePosPrinterAdapter();
  const cashDrawer =
    input.cashDrawer ?? createUnavailablePosCashDrawerAdapter();

  return {
    async getCapabilities() {
      const [scannerAvailable, printerAvailable, cashDrawerAvailable, secure] =
        await Promise.all([
          scanner.isAvailable(),
          printer.isAvailable(),
          cashDrawer.isAvailable(),
          input.secureTerminalCredential(),
        ]);
      return {
        scanner: scannerAvailable,
        printer: printerAvailable,
        cashDrawer: cashDrawerAvailable,
        secureTerminalCredential: secure,
      };
    },
    listPrinters: () => printer.listPrinters(),
    print: (request) => printer.print(request),
    openCashDrawer: (request) => cashDrawer.open(request),
  };
}

export type PosReceiptLine = {
  name: string;
  quantity: number;
  unitAmountMinor: number;
  totalAmountMinor: number;
  note?: string;
};

export type PosReceiptDocument = {
  receiptNo: string;
  orderCode: string;
  issuedAt: string | Date;
  currency: string;
  merchantName: string;
  branchName?: string;
  customerName?: string;
  items: PosReceiptLine[];
  subtotalMinor: number;
  discountMinor?: number;
  totalMinor: number;
  paidMinor: number;
  balanceMinor: number;
  paymentMethod?: string;
  footer?: string;
};

export function buildPosReceiptText(
  receipt: PosReceiptDocument,
  options: DeliveryPrintTemplateOptions = {},
): string {
  return buildPosReceiptLines(receipt, options).join("\n");
}

export function buildPosReceiptEscPos(
  receipt: PosReceiptDocument,
  options: DeliveryPrintTemplateOptions = {},
): Uint8Array {
  return escPosDocument(buildPosReceiptLines(receipt, options), {
    cut: true,
    emphasizedTitle: true,
  });
}

export function createPosReceiptPrintRequest(input: {
  id: string;
  printerId: string;
  receipt: PosReceiptDocument;
  copies?: number;
  options?: DeliveryPrintTemplateOptions;
}): PosPrintRequest {
  return {
    id: input.id,
    printerId: input.printerId,
    title: input.receipt.receiptNo,
    content: buildPosReceiptText(input.receipt, input.options),
    copies: input.copies,
  };
}

export type PortablePrinterConnectionState =
  | "disconnected"
  | "discovering"
  | "connecting"
  | "connected"
  | "printing"
  | "error";

export type PortablePrinterDevice = {
  id: string;
  name?: string;
  rssi?: number;
  connection: Extract<PrinterConnection, "bluetooth">;
  metadata?: Record<string, unknown>;
};

export type PortablePrinterDiscoveryOptions = {
  timeoutMs?: number;
  serviceUuids?: string[];
  namePrefix?: string;
};

export type PortablePrinterConnectionOptions = {
  deviceId: string;
  serviceUuid?: string;
  characteristicUuid?: string;
};

export type PortablePrinterWriteOptions = {
  chunkSize?: number;
  delayMsBetweenChunks?: number;
};

export type PortablePrinterStatus = {
  state: PortablePrinterConnectionState;
  device?: PortablePrinterDevice;
  lastError?: string;
};

export type PortablePrinterPrintJob = Omit<PrintJob, "content"> & {
  title?: string;
  bytes: Uint8Array;
  copies?: number;
};

export interface PortablePrinter {
  getStatus(): PortablePrinterStatus;
  discover(options?: PortablePrinterDiscoveryOptions): Promise<PortablePrinterDevice[]>;
  connect(options: PortablePrinterConnectionOptions): Promise<PortablePrinterDevice>;
  disconnect(): Promise<void>;
  print(job: PortablePrinterPrintJob, options?: PortablePrinterWriteOptions): Promise<void>;
}

export type PortablePrinterUnavailableOptions = {
  reason?: string;
};

export type PrintLocale = "en" | "fr" | "zh-CN";
export type DeliveryPrintKind = "pickup" | "delivery";
export type DeliveryDocumentKind = "receipt" | "label";

export type DeliveryPrintCustomer = {
  name?: string;
  phone?: string;
};

export type DeliveryPrintAddress = {
  label?: string;
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
  formatted?: string;
};

export type DeliveryPrintItem = {
  name: string;
  quantity?: number;
  note?: string;
};

export type DeliveryPrintTask = {
  taskId: string;
  kind: DeliveryPrintKind;
  customer: DeliveryPrintCustomer;
  address: DeliveryPrintAddress | string;
  tenantName?: string;
  branchName?: string;
  orderId?: string;
  workOrderId?: string;
  scheduledAt?: string | Date;
  completedAt?: string | Date;
  note?: string;
  items?: DeliveryPrintItem[];
};

export type DeliveryPrintTemplateOptions = {
  locale?: PrintLocale;
  paperWidth?: 32 | 42 | 48;
  now?: Date;
};

export const defaultEscPosPrinterProfile = {
  serviceUuid: "0000ffe0-0000-1000-8000-00805f9b34fb",
  characteristicUuid: "0000ffe1-0000-1000-8000-00805f9b34fb",
  chunkSize: 180,
  delayMsBetweenChunks: 20,
} as const;

const receiptLabels = {
  en: {
    pickupTitle: "PICKUP RECEIPT",
    deliveryTitle: "DELIVERY RECEIPT",
    labelPickupTitle: "PICKUP LABEL",
    labelDeliveryTitle: "DELIVERY LABEL",
    customer: "Customer",
    phone: "Phone",
    address: "Address",
    order: "Order",
    workOrder: "Work order",
    task: "Task",
    scheduled: "Scheduled",
    completed: "Completed",
    branch: "Branch",
    note: "Note",
    items: "Items",
    printed: "Printed",
    fallback: "N/A",
  },
  fr: {
    pickupTitle: "RECU DE COLLECTE",
    deliveryTitle: "RECU DE LIVRAISON",
    labelPickupTitle: "ETIQUETTE COLLECTE",
    labelDeliveryTitle: "ETIQUETTE LIVRAISON",
    customer: "Client",
    phone: "Telephone",
    address: "Adresse",
    order: "Commande",
    workOrder: "Bon de travail",
    task: "Tache",
    scheduled: "Planifie",
    completed: "Termine",
    branch: "Agence",
    note: "Note",
    items: "Articles",
    printed: "Imprime",
    fallback: "N/A",
  },
  "zh-CN": {
    pickupTitle: "取件小票",
    deliveryTitle: "送达小票",
    labelPickupTitle: "取件标签",
    labelDeliveryTitle: "送达标签",
    customer: "客户",
    phone: "电话",
    address: "地址",
    order: "订单",
    workOrder: "工单",
    task: "任务",
    scheduled: "预约时间",
    completed: "完成时间",
    branch: "门店",
    note: "备注",
    items: "件数",
    printed: "打印时间",
    fallback: "无",
  },
} as const satisfies Record<PrintLocale, Record<string, string>>;

const posReceiptLabels = {
  en: {
    title: "RECEIPT",
    receipt: "Receipt",
    order: "Order",
    customer: "Customer",
    items: "Items",
    subtotal: "Subtotal",
    discount: "Discount",
    total: "Total",
    paid: "Paid",
    balance: "Balance",
    payment: "Payment",
    issued: "Issued",
  },
  fr: {
    title: "RECU",
    receipt: "Recu",
    order: "Commande",
    customer: "Client",
    items: "Articles",
    subtotal: "Sous-total",
    discount: "Remise",
    total: "Total",
    paid: "Paye",
    balance: "Solde",
    payment: "Paiement",
    issued: "Emis",
  },
  "zh-CN": {
    title: "收据",
    receipt: "收据号",
    order: "订单",
    customer: "客户",
    items: "项目",
    subtotal: "小计",
    discount: "优惠",
    total: "合计",
    paid: "已付",
    balance: "余额",
    payment: "支付方式",
    issued: "开具时间",
  },
} as const satisfies Record<PrintLocale, Record<string, string>>;

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const encoder = new TextEncoder();

export function buildPickupReceiptEscPos(
  task: Omit<DeliveryPrintTask, "kind">,
  options?: DeliveryPrintTemplateOptions,
): Uint8Array {
  return buildDeliveryReceiptEscPos({ ...task, kind: "pickup" }, options);
}

export function buildDeliveryReceiptEscPos(
  task: DeliveryPrintTask,
  options: DeliveryPrintTemplateOptions = {},
): Uint8Array {
  return escPosDocument(buildDeliveryReceiptLines(task, options), { cut: true });
}

export function buildPickupReceiptText(
  task: Omit<DeliveryPrintTask, "kind">,
  options?: DeliveryPrintTemplateOptions,
): string {
  return buildDeliveryReceiptText({ ...task, kind: "pickup" }, options);
}

export function buildDeliveryReceiptText(
  task: DeliveryPrintTask,
  options: DeliveryPrintTemplateOptions = {},
): string {
  return buildDeliveryReceiptLines(task, options).join("\n");
}

export function buildPickupLabelEscPos(
  task: Omit<DeliveryPrintTask, "kind">,
  options?: DeliveryPrintTemplateOptions,
): Uint8Array {
  return buildDeliveryLabelEscPos({ ...task, kind: "pickup" }, options);
}

export function buildDeliveryLabelEscPos(
  task: DeliveryPrintTask,
  options: DeliveryPrintTemplateOptions = {},
): Uint8Array {
  return escPosDocument(buildDeliveryLabelLines(task, options), {
    cut: true,
    emphasizedTitle: true,
  });
}

export function buildPickupLabelText(
  task: Omit<DeliveryPrintTask, "kind">,
  options?: DeliveryPrintTemplateOptions,
): string {
  return buildDeliveryLabelText({ ...task, kind: "pickup" }, options);
}

export function buildDeliveryLabelText(
  task: DeliveryPrintTask,
  options: DeliveryPrintTemplateOptions = {},
): string {
  return buildDeliveryLabelLines(task, options).join("\n");
}

export function createPortablePrinterPrintJob(input: {
  id: string;
  printerId: string;
  title?: string;
  bytes: Uint8Array;
  copies?: number;
}): PortablePrinterPrintJob {
  return {
    id: input.id,
    printerId: input.printerId,
    title: input.title,
    bytes: input.bytes,
    copies: input.copies,
  };
}

export function createUnavailablePortablePrinter(
  options: PortablePrinterUnavailableOptions = {},
): PortablePrinter {
  const reason =
    options.reason ??
    "Portable Bluetooth printing is not available in this runtime.";

  return {
    getStatus() {
      return {
        state: "error",
        lastError: reason,
      };
    },
    async discover() {
      throw new Error(reason);
    },
    async connect() {
      throw new Error(reason);
    },
    async disconnect() {
      return undefined;
    },
    async print() {
      throw new Error(reason);
    },
  };
}

export function getPortablePrinterErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Portable printer operation failed.";
}

function buildDeliveryReceiptLines(
  task: DeliveryPrintTask,
  options: DeliveryPrintTemplateOptions,
): string[] {
  const width = options.paperWidth ?? 32;
  const labels = getLabels(options.locale);
  const title = task.kind === "pickup" ? labels.pickupTitle : labels.deliveryTitle;
  return compactLines([
    center(task.tenantName ?? "CleanHub", width),
    center(title, width),
    rule(width),
    task.branchName ? keyValue(labels.branch, task.branchName) : undefined,
    keyValue(labels.task, task.taskId),
    task.orderId ? keyValue(labels.order, task.orderId) : undefined,
    task.workOrderId ? keyValue(labels.workOrder, task.workOrderId) : undefined,
    keyValue(labels.customer, task.customer.name ?? labels.fallback),
    task.customer.phone ? keyValue(labels.phone, task.customer.phone) : undefined,
    labels.address,
    ...wrapText(formatAddress(task.address), width),
    task.scheduledAt
      ? keyValue(labels.scheduled, formatDateTime(task.scheduledAt, options.locale))
      : undefined,
    task.completedAt
      ? keyValue(labels.completed, formatDateTime(task.completedAt, options.locale))
      : undefined,
    ...(task.items?.length
      ? [
          labels.items,
          ...task.items.flatMap((item) =>
            wrapText(
              `- ${item.name}${item.quantity ? ` x${item.quantity}` : ""}${
                item.note ? ` (${item.note})` : ""
              }`,
              width,
            ),
          ),
        ]
      : []),
    task.note ? keyValue(labels.note, task.note) : undefined,
    rule(width),
    keyValue(labels.printed, formatDateTime(options.now ?? new Date(), options.locale)),
  ]);
}

function buildPosReceiptLines(
  receipt: PosReceiptDocument,
  options: DeliveryPrintTemplateOptions,
): string[] {
  const width = options.paperWidth ?? 32;
  const locale = options.locale ?? "en";
  const labels = posReceiptLabels[locale];
  const amountFormatter = new Intl.NumberFormat(toIntlLocale(locale), {
    style: "currency",
    currency: receipt.currency,
  });
  const fractionDigits =
    amountFormatter.resolvedOptions().maximumFractionDigits ?? 2;
  const minorUnitDivisor = 10 ** fractionDigits;
  const amount = (value: number) =>
    amountFormatter.format(value / minorUnitDivisor);

  return compactLines([
    center(receipt.merchantName, width),
    center(labels.title, width),
    receipt.branchName ? center(receipt.branchName, width) : undefined,
    rule(width),
    keyValue(labels.receipt, receipt.receiptNo),
    keyValue(labels.order, receipt.orderCode),
    receipt.customerName
      ? keyValue(labels.customer, receipt.customerName)
      : undefined,
    keyValue(labels.issued, formatDateTime(receipt.issuedAt, locale)),
    rule(width),
    labels.items,
    ...receipt.items.flatMap((item) =>
      wrapText(
        `${item.name} x${item.quantity} ${amount(item.totalAmountMinor)}${
          item.note ? ` (${item.note})` : ""
        }`,
        width,
      ),
    ),
    rule(width),
    keyValue(labels.subtotal, amount(receipt.subtotalMinor)),
    receipt.discountMinor
      ? keyValue(labels.discount, `-${amount(receipt.discountMinor)}`)
      : undefined,
    keyValue(labels.total, amount(receipt.totalMinor)),
    keyValue(labels.paid, amount(receipt.paidMinor)),
    keyValue(labels.balance, amount(receipt.balanceMinor)),
    receipt.paymentMethod
      ? keyValue(labels.payment, receipt.paymentMethod)
      : undefined,
    receipt.footer ? rule(width) : undefined,
    receipt.footer ? center(receipt.footer, width) : undefined,
  ]);
}

function buildDeliveryLabelLines(
  task: DeliveryPrintTask,
  options: DeliveryPrintTemplateOptions,
): string[] {
  const width = options.paperWidth ?? 32;
  const labels = getLabels(options.locale);
  const title = task.kind === "pickup" ? labels.labelPickupTitle : labels.labelDeliveryTitle;
  const identifiers = [task.orderId, task.workOrderId, task.taskId].filter(Boolean).join(" / ");
  return compactLines([
    center(title, width),
    rule(width),
    identifiers,
    keyValue(labels.customer, task.customer.name ?? labels.fallback),
    task.customer.phone ? keyValue(labels.phone, task.customer.phone) : undefined,
    ...wrapText(formatAddress(task.address), width),
    task.scheduledAt
      ? keyValue(labels.scheduled, formatDateTime(task.scheduledAt, options.locale))
      : undefined,
  ]);
}

function escPosDocument(
  lines: string[],
  options: { cut?: boolean; emphasizedTitle?: boolean } = {},
): Uint8Array {
  const chunks: number[] = [
    ESC,
    0x40,
    ESC,
    0x61,
    0x00,
  ];

  lines.forEach((line, index) => {
    if (index === 0 && options.emphasizedTitle) {
      chunks.push(ESC, 0x45, 0x01, GS, 0x21, 0x11);
      chunks.push(...toBytes(line), LF);
      chunks.push(GS, 0x21, 0x00, ESC, 0x45, 0x00);
      return;
    }

    chunks.push(...toBytes(line), LF);
  });

  chunks.push(LF, LF);

  if (options.cut) {
    chunks.push(GS, 0x56, 0x42, 0x00);
  }

  return Uint8Array.from(chunks);
}

function toBytes(value: string): number[] {
  return Array.from(encoder.encode(value));
}

function getLabels(locale: PrintLocale = "en") {
  return receiptLabels[locale] ?? receiptLabels.en;
}

function compactLines(lines: Array<string | undefined>): string[] {
  return lines.filter((line): line is string => Boolean(line));
}

function keyValue(key: string, value: string): string {
  return `${key}: ${value}`;
}

function center(value: string, width: number): string {
  if (value.length >= width) {
    return value;
  }

  const padding = Math.floor((width - value.length) / 2);
  return `${" ".repeat(padding)}${value}`;
}

function rule(width: number): string {
  return "-".repeat(width);
}

function wrapText(value: string, width: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length > width) {
      lines.push(current);
      current = word;
      continue;
    }

    current = `${current} ${word}`;
  }

  if (current) {
    lines.push(current);
  }

  return lines.length ? lines : [value];
}

function formatAddress(address: DeliveryPrintAddress | string): string {
  if (typeof address === "string") {
    return address;
  }

  if (address.formatted) {
    return address.formatted;
  }

  return [
    address.label,
    address.line1,
    address.line2,
    address.city,
    address.region,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatDateTime(value: string | Date, locale: PrintLocale = "en"): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function toIntlLocale(locale: PrintLocale): string {
  return locale === "zh-CN" ? "zh-CN" : locale;
}
