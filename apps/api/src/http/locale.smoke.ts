import { resolveRequestLocale } from "./locale.js";

let failures = 0;

function check(
  label: string,
  header: string | null | undefined,
  expected: string,
): void {
  const actual = resolveRequestLocale(header);
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
    failures += 1;
  }
}

// The POS sends a single tag; these are the three it can send.
check("chinese", "zh-CN", "zh-CN");
check("english", "en", "en");
check("french", "fr", "fr");

// Region subtags and underscores are normalised rather than rejected.
check("region subtag", "fr-SN", "fr");
check("chinese simplified", "zh-Hans", "zh-CN");
check("underscore form", "zh_CN", "zh-CN");
check("case insensitive", "FR", "fr");

// A weighted list must pick the highest-weighted tag this API supports, not
// simply the first: a browser sending "de,en;q=0.8" wants English, not the
// default.
check("weighted list", "de;q=1.0,en;q=0.8", "en");
check("ordered by weight", "en;q=0.3,zh-CN;q=0.9", "zh-CN");
check("first tag wins at equal weight", "fr,en", "fr");

// Anything unusable falls back to the configured default rather than throwing.
check("missing header", null, "fr");
check("undefined header", undefined, "fr");
check("empty header", "", "fr");
check("unsupported language", "de", "fr");
check("wildcard", "*", "fr");
check("malformed weight", "en;q=abc", "fr");

// q=0 means "explicitly not this one".
check("zero weight is refused", "en;q=0,fr;q=0.5", "fr");

if (failures > 0) {
  console.error(`\nLocale resolution check failed with ${failures} problem(s).`);
  process.exit(1);
}

console.log("Locale resolution passed.");
