/**
 * Browser-side CSV generation + download helpers.
 *
 * No external dependency (papaparse/xlsx) — these run on the already-loaded
 * report data and rely only on `Blob` + an anchor click. Quoting follows
 * RFC 4180 so Excel/Numbers/Google Sheets import the output cleanly.
 */

/** Escape and quote a single CSV cell, only when it needs it. */
export function toCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  // Quote when the cell contains a delimiter, quote, newline, or leading/
  // trailing whitespace. Embedded quotes are doubled per RFC 4180.
  if (/[",\n\r]|\s$|^\s/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

/** Join a row of cell values into a CSV line. */
export function toCsvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(toCsvCell).join(",");
}

/**
 * Build a CSV document from a header row + data rows.
 *
 * The output always ends with a trailing newline and a UTF-8 BOM prefix so
 * Excel on Windows opens it with the correct encoding.
 */
export function toCsvDocument(
  header: Array<string | number | null | undefined>,
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines = [toCsvRow(header), ...rows.map(toCsvRow)];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/**
 * Trigger a browser download for a CSV string.
 *
 * `filename` should include the `.csv` extension. Safe to call only in the
 * browser (guards on `document`); SSR callers must gate the call themselves.
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === "undefined") {
    return;
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Release the object URL on the next tick so the click has time to fire.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
