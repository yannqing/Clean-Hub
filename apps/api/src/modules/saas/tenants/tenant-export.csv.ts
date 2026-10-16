/**
 * RFC 4180 CSV serialisation for tenant data exports.
 *
 * Deliberately duplicated from the browser helper in `web-admin`: that one
 * builds a `Blob` and depends on `document`, so it cannot run on the server.
 * The quoting rules are kept identical so both produce the same file.
 */

/** Escape and quote a single CSV cell, only when it needs it. */
export function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);

  // Quote when the cell contains a delimiter, quote, newline, or leading/
  // trailing whitespace. Embedded quotes are doubled per RFC 4180.
  if (/[",\n\r]|\s$|^\s/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

/** Join a row of cell values into a CSV line. */
export function toCsvRow(cells: readonly unknown[]): string {
  return cells.map(toCsvCell).join(",");
}

/**
 * Build a CSV document from a header row + data rows.
 *
 * Ends with a trailing newline and carries a UTF-8 BOM so Excel on Windows
 * opens it with the right encoding — the tenant receiving this export is more
 * likely to open it in a spreadsheet than to parse it.
 */
/**
 * UTF-8 byte order mark. Built from a char code rather than written inline:
 * as a literal it is invisible whitespace in the source, which lint rightly
 * rejects. Excel needs it to read the file as UTF-8 rather than as the local
 * codepage, which is what garbles non-ASCII customer names.
 */
const UTF8_BOM = String.fromCharCode(0xfeff);

export function toCsvDocument(
  header: readonly unknown[],
  rows: readonly (readonly unknown[])[],
): string {
  const lines = [toCsvRow(header), ...rows.map((row) => toCsvRow(row))];
  return `${UTF8_BOM}${lines.join("\r\n")}\r\n`;
}
