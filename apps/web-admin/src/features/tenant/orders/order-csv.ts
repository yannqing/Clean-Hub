import { formatPosOrderCode } from "@cleanhub/domain/order-codes";
import { createId } from "@cleanhub/id";
import type {
  TenantOrderImportRequest,
  TenantOrderSummary,
} from "@cleanhub/api-client";

import { downloadCsv, toCsvDocument } from "@/lib/csv";

export const TENANT_ORDER_IMPORT_HEADERS = [
  "order_key",
  "branch_id",
  "customer_id",
  "service_id",
  "quantity",
  "weight",
  "bag_count",
  "notes",
  "expire_at",
] as const;

const REQUIRED_IMPORT_HEADERS = [
  "order_key",
  "branch_id",
  "customer_id",
  "service_id",
] as const;
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const MAX_IMPORT_ROWS = 500;
const MAX_IMPORT_ORDERS = 100;

type ImportHeader = (typeof TENANT_ORDER_IMPORT_HEADERS)[number];

export type TenantOrderCsvParseError =
  | { code: "empty" }
  | { code: "malformed" }
  | { code: "missing_headers"; headers: string[] }
  | { code: "missing_values"; fields: string[]; row: number }
  | { code: "invalid_value"; field: string; row: number }
  | { code: "conflicting_order"; orderKey: string; row: number }
  | { code: "too_many_rows"; limit: number }
  | { code: "too_many_orders"; limit: number };

export type TenantOrderCsvParseResult =
  | {
      ok: true;
      data: TenantOrderImportRequest;
      orderCount: number;
      rowCount: number;
    }
  | { ok: false; errors: TenantOrderCsvParseError[] };

function parseCsvRows(input: string): string[][] | null {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      row.push(cell);
      if (row.some((value) => value.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
    } else {
      cell += character;
    }
  }

  if (quoted) {
    return null;
  }

  row.push(cell);
  if (row.some((value) => value.trim().length > 0)) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function getCell(
  row: string[],
  headerIndexes: Map<string, number>,
  header: ImportHeader,
): string {
  const index = headerIndexes.get(header);
  return index === undefined ? "" : (row[index] ?? "").trim();
}

export function parseTenantOrderImportCsv(
  input: string,
): TenantOrderCsvParseResult {
  const rows = parseCsvRows(input);
  if (!rows) {
    return { ok: false, errors: [{ code: "malformed" }] };
  }
  if (rows.length < 2) {
    return { ok: false, errors: [{ code: "empty" }] };
  }

  const headerIndexes = new Map(
    rows[0].map((header, index) => [normalizeHeader(header), index]),
  );
  const missingHeaders = REQUIRED_IMPORT_HEADERS.filter(
    (header) => !headerIndexes.has(header),
  );
  if (missingHeaders.length > 0) {
    return {
      ok: false,
      errors: [{ code: "missing_headers", headers: [...missingHeaders] }],
    };
  }

  const dataRows = rows.slice(1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      errors: [{ code: "too_many_rows", limit: MAX_IMPORT_ROWS }],
    };
  }

  const orders = new Map<string, TenantOrderImportRequest["orders"][number]>();
  const errors: TenantOrderCsvParseError[] = [];

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const orderKey = getCell(row, headerIndexes, "order_key");
    const branchId = getCell(row, headerIndexes, "branch_id");
    const customerId = getCell(row, headerIndexes, "customer_id") || undefined;
    const serviceId = getCell(row, headerIndexes, "service_id");
    const quantity = getCell(row, headerIndexes, "quantity");
    const weight = getCell(row, headerIndexes, "weight");
    const bagCount = getCell(row, headerIndexes, "bag_count");
    const notes = getCell(row, headerIndexes, "notes");
    const expireAt = getCell(row, headerIndexes, "expire_at");
    const missingValues = [
      ["order_key", orderKey],
      ["branch_id", branchId],
      ["service_id", serviceId],
    ]
      .filter(([, value]) => !value)
      .map(([field]) => field);

    if (missingValues.length > 0) {
      errors.push({
        code: "missing_values",
        fields: missingValues,
        row: rowNumber,
      });
      return;
    }

    for (const [field, value] of [
      ["branch_id", branchId],
      ["service_id", serviceId],
    ] as const) {
      if (!ULID_PATTERN.test(value)) {
        errors.push({ code: "invalid_value", field, row: rowNumber });
        return;
      }
    }
    if (customerId && !ULID_PATTERN.test(customerId)) {
      errors.push({ code: "invalid_value", field: "customer_id", row: rowNumber });
      return;
    }

    if (!quantity && !weight) {
      errors.push({
        code: "missing_values",
        fields: ["quantity/weight"],
        row: rowNumber,
      });
      return;
    }
    if (quantity && (!/^\d+$/.test(quantity) || Number(quantity) < 1)) {
      errors.push({
        code: "invalid_value",
        field: "quantity",
        row: rowNumber,
      });
      return;
    }
    if (weight && (!/^\d+(\.\d{1,3})?$/.test(weight) || Number(weight) <= 0)) {
      errors.push({
        code: "invalid_value",
        field: "weight",
        row: rowNumber,
      });
      return;
    }
    if (
      bagCount &&
      (!/^\d+$/.test(bagCount) ||
        Number(bagCount) < 1 ||
        Number(bagCount) > 9999)
    ) {
      errors.push({
        code: "invalid_value",
        field: "bag_count",
        row: rowNumber,
      });
      return;
    }
    if (expireAt && Number.isNaN(Date.parse(expireAt))) {
      errors.push({
        code: "invalid_value",
        field: "expire_at",
        row: rowNumber,
      });
      return;
    }

    const existing = orders.get(orderKey);
    if (
      existing &&
      (existing.branchId !== branchId ||
        existing.customerId !== customerId ||
        (notes && existing.notes && existing.notes !== notes) ||
        (expireAt && existing.expireAt && existing.expireAt !== expireAt))
    ) {
      errors.push({
        code: "conflicting_order",
        orderKey,
        row: rowNumber,
      });
      return;
    }

    const item = {
      serviceId,
      ...(quantity ? { quantity } : {}),
      ...(weight ? { weight } : {}),
      ...(bagCount ? { bagCount: Number(bagCount) } : {}),
    };

    if (existing) {
      if (notes && !existing.notes) {
        existing.notes = notes;
      }
      if (expireAt && !existing.expireAt) {
        existing.expireAt = expireAt;
      }
      existing.items.push(item);
    } else {
      orders.set(orderKey, {
        id: createId(),
        importKey: orderKey,
        branchId,
        ...(customerId ? { customerId } : {}),
        ...(notes ? { notes } : {}),
        ...(expireAt ? { expireAt } : {}),
        items: [item],
      });
    }
  });

  if (orders.size > MAX_IMPORT_ORDERS) {
    errors.push({ code: "too_many_orders", limit: MAX_IMPORT_ORDERS });
  }
  if (errors.length > 0) {
    return { ok: false, errors: errors.slice(0, 20) };
  }

  return {
    ok: true,
    data: { orders: [...orders.values()] },
    orderCount: orders.size,
    rowCount: dataRows.length,
  };
}

export function downloadTenantOrderImportTemplate(): void {
  downloadCsv(
    "cleanhub-order-import-template.csv",
    toCsvDocument([...TENANT_ORDER_IMPORT_HEADERS], []),
  );
}

export type TenantOrderExportLabels = {
  headers: string[];
  typeLabels: Record<TenantOrderSummary["orderType"], string>;
  statusLabels: Record<TenantOrderSummary["status"], string>;
  paymentStatusLabels: Record<TenantOrderSummary["paymentStatus"], string>;
  unknownCustomer: string;
  guestCustomer: string;
};

function protectSpreadsheetCell(value: string): string {
  return /^[=+\-@]/.test(value.trimStart()) ? `'${value}` : value;
}

export function downloadTenantOrderExport(
  orders: TenantOrderSummary[],
  branchNames: Record<string, string>,
  labels: TenantOrderExportLabels,
): void {
  const rows = orders.map((order) => [
    formatPosOrderCode(order.id),
    order.id,
    protectSpreadsheetCell(
      order.customerName ||
        (order.customerId ? labels.unknownCustomer : labels.guestCustomer),
    ),
    order.customerId ?? "",
    protectSpreadsheetCell(branchNames[order.branchId] ?? order.branchId),
    order.branchId,
    labels.typeLabels[order.orderType],
    order.itemCount,
    protectSpreadsheetCell(order.itemNames.join(" / ")),
    order.subtotalAmount,
    order.discountAmount,
    order.totalAmount,
    order.currency,
    order.paidAmount,
    labels.paymentStatusLabels[order.paymentStatus],
    labels.statusLabels[order.status],
    protectSpreadsheetCell(order.notes ?? ""),
    order.createdAt,
    order.updatedAt,
  ]);

  downloadCsv(
    `cleanhub-orders-${new Date().toISOString().slice(0, 10)}.csv`,
    toCsvDocument(labels.headers, rows),
  );
}
