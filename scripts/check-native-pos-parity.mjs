import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The native Android POS reimplements some server rules in Kotlin, and nothing
 * at runtime notices when the two drift apart -- an offline total simply stops
 * matching the price the server quotes, and the replayed sale is rejected.
 *
 * This checks the copies that are cheap to compare mechanically. It is not a
 * substitute for reading "Native Android POS" in CLAUDE.md before changing a
 * rule; it only catches the drift that is visible as a list.
 */
const failures = [];

function read(relativePath) {
  return readFileSync(join(rootDir, relativePath), "utf8");
}

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) {
    throw new Error(`Could not locate ${startMarker}..${endMarker}`);
  }
  return source.slice(start, end);
}

function compare(label, expected, actual) {
  const missing = expected.filter((item) => !actual.includes(item));
  const extra = actual.filter((item) => !expected.includes(item));
  if (missing.length === 0 && extra.length === 0) return;
  failures.push(
    [
      `${label} has drifted.`,
      missing.length > 0 ? `  missing from Kotlin: ${missing.join(", ")}` : null,
      extra.length > 0 ? `  only in Kotlin: ${extra.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

// --- zero-decimal currencies ------------------------------------------------

const currencyTs = section(
  read("packages/domain/src/currency.ts"),
  "CURRENCY_MINOR_UNITS",
  "DEFAULT_MINOR_UNITS",
);
const currencyKt = section(
  read(
    "apps/pos-mobile/android/app/src/main/kotlin/com/cleanhub/pos/nativepos/NativeCurrency.kt",
  ),
  "CURRENCY_MINOR_UNITS",
  "DEFAULT_MINOR_UNITS",
);

compare(
  "Zero-decimal currency list (packages/domain/src/currency.ts vs NativeCurrency.kt)",
  [...currencyTs.matchAll(/^\s+([A-Z]{3}): 0,/gm)].map((match) => match[1]),
  [...currencyKt.matchAll(/"([A-Z]{3})" to 0/g)].map((match) => match[1]),
);

// --- ticket state machines --------------------------------------------------

const stateMachineTs = read(
  "apps/api/src/modules/pos/service-tickets/service-tickets.state-machine.ts",
);
const stateMachineKt = read(
  "apps/pos-mobile/android/app/src/main/kotlin/com/cleanhub/pos/nativepos/NativePosApp.kt",
);

function tsTransitions(source, constName) {
  const block = section(source, `const ${constName}`, "};");
  return [...block.matchAll(/^\s+(\w+):\s*\[([^\]]*)\]/gm)].map(
    ([, from, to]) =>
      `${from}->${[...to.matchAll(/"(\w+)"/g)].map((m) => m[1]).sort().join("|")}`,
  );
}

function ktTransitions(source, constName) {
  const block = section(source, `val ${constName}`, "\n)\n");
  // `emptyList()` is Kotlin's spelling of the `[]` a terminal state has in
  // TypeScript, so both forms must be recognised or every terminal state looks
  // like drift.
  return [...block.matchAll(/"(\w+)" to (?:listOf\(([^)]*)\)|emptyList\(\))/g)].map(
    ([, from, to]) =>
      `${from}->${[...(to ?? "").matchAll(/"(\w+)"/g)].map((m) => m[1]).sort().join("|")}`,
  );
}

compare(
  "Ticket status transitions (service-tickets.state-machine.ts vs NativePosApp.kt)",
  tsTransitions(stateMachineTs, "TICKET_TRANSITIONS"),
  ktTransitions(stateMachineKt, "TICKET_STATUS_TRANSITIONS"),
);

compare(
  "Ticket item status transitions (service-tickets.state-machine.ts vs NativePosApp.kt)",
  tsTransitions(stateMachineTs, "ITEM_TRANSITIONS"),
  ktTransitions(stateMachineKt, "TICKET_ITEM_STATUS_TRANSITIONS"),
);

// --- report -----------------------------------------------------------------

if (failures.length > 0) {
  console.error(
    `Native POS parity check failed:\n\n${failures.join("\n\n")}\n\n` +
      "The Kotlin POS is a second implementation of these rules. Update it to " +
      "match, or the two disagree silently at the till.",
  );
  process.exitCode = 1;
} else {
  console.log("Native POS parity check passed.");
}
