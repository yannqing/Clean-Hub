import type { ImportTenantProductsRequest } from "@cleanhub/api-client";
import type { ProductFormErrorCode } from "./types";
import { validateProductForm } from "./validators";
import { downloadCsv, toCsvDocument } from "@/lib/csv";

export const PRODUCT_IMPORT_HEADERS = [
  "name",
  "sale_price",
  "sku_code",
  "barcode",
  "variant_name",
  "brand",
  "unit_of_measure",
  "reference_cost",
  "status",
  "track_inventory",
  "opening_stock",
  "reorder_point",
  "allow_negative_stock",
  "allow_offline_sale",
  "description",
  "tags",
] as const;
export const PRODUCT_IMPORT_MAX_BYTES = 512 * 1024;

type CsvRow = { line: number; cells: string[] };
export type ProductImportError = {
  row?: number;
  field?: string;
  code:
    | "empty"
    | "malformed"
    | "headers"
    | "tooMany"
    | "invalidBoolean"
    | ProductFormErrorCode;
};

// Strict CSV parsing: quoted commas/newlines, escaped quotes and UTF-8 BOM.
// Keep physical line numbers so a failed row can be found in the source file.
function parseRows(input: string): CsvRow[] | null {
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(input)) return null;
  const text = input.replace(/^\uFEFF/, "");
  const rows: CsvRow[] = [];
  let cells: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  let line = 1,
    rowLine = 1;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          closed = true;
        }
      } else {
        cell += char;
        if (char === "\n" || (char === "\r" && text[index + 1] !== "\n"))
          line += 1;
      }
    } else if (char === ",") {
      cells.push(cell);
      cell = "";
      closed = false;
    } else if (char === "\r" || char === "\n") {
      cells.push(cell);
      if (cells.some((value) => value.trim()))
        rows.push({ line: rowLine, cells });
      cells = [];
      cell = "";
      closed = false;
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      line += 1;
      rowLine = line;
    } else if (char === '"' && cell === "" && !closed) {
      quoted = true;
    } else {
      if (closed || char === '"') return null;
      cell += char;
    }
  }
  if (quoted) return null;
  cells.push(cell);
  if (cells.some((value) => value.trim())) rows.push({ line: rowLine, cells });
  return rows;
}

export function parseProductImportCsv(
  input: string,
  branchIds: string[],
  currency: string,
):
  | { ok: true; products: ImportTenantProductsRequest["products"] }
  | { ok: false; errors: ProductImportError[] } {
  const rows = parseRows(input);
  if (!rows) return { ok: false, errors: [{ code: "malformed" }] };
  if (rows.length < 2) return { ok: false, errors: [{ code: "empty" }] };
  const headers = rows[0].cells.map((value) => value.trim().toLowerCase());
  if (
    new Set(headers).size !== headers.length ||
    !["name", "sale_price"].every((key) => headers.includes(key)) ||
    headers.some(
      (key) =>
        !PRODUCT_IMPORT_HEADERS.includes(
          key as (typeof PRODUCT_IMPORT_HEADERS)[number],
        ),
    )
  ) {
    return { ok: false, errors: [{ code: "headers" }] };
  }
  if (rows.length > 101) return { ok: false, errors: [{ code: "tooMany" }] };
  const products: ImportTenantProductsRequest["products"] = [];
  const errors: ProductImportError[] = [];
  const skus = new Set<string>(),
    barcodes = new Set<string>();
  for (const row of rows.slice(1)) {
    if (row.cells.length !== headers.length) {
      errors.push({ row: row.line, code: "malformed" });
      continue;
    }
    const cell = (key: string) =>
      (row.cells[headers.indexOf(key)] ?? "").trim();
    const boolean = (key: string, fallback: boolean) => {
      const value = cell(key).toLowerCase();
      if (!value) return fallback;
      if (value === "true" || value === "1") return true;
      if (value === "false" || value === "0") return false;
      errors.push({ row: row.line, field: key, code: "invalidBoolean" });
      return fallback;
    };
    const result = validateProductForm({
      name: cell("name"),
      salePrice: cell("sale_price"),
      skuCode: cell("sku_code"),
      barcode: cell("barcode"),
      variantName: cell("variant_name"),
      brand: cell("brand"),
      unitOfMeasure: cell("unit_of_measure") || "piece",
      unitsPerSale: "1",
      referenceCost: cell("reference_cost"),
      status: cell("status") || "active",
      trackInventory: boolean("track_inventory", true),
      allowNegativeStock: boolean("allow_negative_stock", false),
      allowOfflineSale: boolean("allow_offline_sale", false),
      branchSettings: branchIds.map((branchId) => ({
        branchId,
        openingStock: cell("opening_stock") || "0",
        reorderPoint: cell("reorder_point") || "0",
      })),
      currency,
      description: cell("description"),
      tags: cell("tags").split("|").filter(Boolean),
      categoryId: "",
      categoryAttributes: [],
      mediaObjectKeys: [],
      taxRateId: "",
    });
    if (!result.ok) {
      for (const [field, code] of Object.entries(result.errors)) {
        if (code) errors.push({ row: row.line, field, code });
      }
      continue;
    }
    const { currency: _currency, ...product } = result.data;
    void _currency;
    if (product.skuCode && skus.has(product.skuCode))
      errors.push({
        row: row.line,
        field: "sku_code",
        code: "skuCodeDuplicate",
      });
    if (product.barcode && barcodes.has(product.barcode))
      errors.push({
        row: row.line,
        field: "barcode",
        code: "barcodeDuplicate",
      });
    if (product.skuCode) skus.add(product.skuCode);
    if (product.barcode) barcodes.add(product.barcode);
    products.push({ rowNumber: row.line, product });
  }
  return errors.length ? { ok: false, errors } : { ok: true, products };
}

export function downloadProductImportTemplate(): void {
  downloadCsv(
    "cleanhub-products-template.csv",
    toCsvDocument([...PRODUCT_IMPORT_HEADERS], []),
  );
}
