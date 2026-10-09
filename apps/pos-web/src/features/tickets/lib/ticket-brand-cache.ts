const TICKET_BRAND_CACHE_KEY = "cleanhub:pos:ticket-custom-brands:v1";
const TICKET_BRAND_CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_CACHED_TICKET_BRANDS = 50;

type CachedTicketBrand = {
  expiresAt: number;
  value: string;
};

function normalizeBrand(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function readEntries(now = Date.now()): CachedTicketBrand[] {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(TICKET_BRAND_CACHE_KEY) ?? "[]",
    ) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (entry): entry is CachedTicketBrand =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as CachedTicketBrand).value === "string" &&
        typeof (entry as CachedTicketBrand).expiresAt === "number" &&
        (entry as CachedTicketBrand).expiresAt > now,
    );
  } catch {
    return [];
  }
}

function writeEntries(entries: CachedTicketBrand[]): void {
  try {
    window.localStorage.setItem(TICKET_BRAND_CACHE_KEY, JSON.stringify(entries));
  } catch {
    // POS may run with storage disabled. Brand selection should still work.
  }
}

export function loadCachedTicketBrands(): string[] {
  const entries = readEntries();
  writeEntries(entries);
  return entries.map((entry) => entry.value);
}

export function rememberTicketBrand(value: string): string[] {
  const normalized = normalizeBrand(value);
  if (!normalized) return loadCachedTicketBrands();

  const now = Date.now();
  const entries = readEntries(now).filter(
    (entry) => entry.value.toLocaleLowerCase() !== normalized.toLocaleLowerCase(),
  );
  entries.unshift({
    expiresAt: now + TICKET_BRAND_CACHE_TTL_MS,
    value: normalized,
  });
  const limited = entries.slice(0, MAX_CACHED_TICKET_BRANDS);
  writeEntries(limited);
  return limited.map((entry) => entry.value);
}
