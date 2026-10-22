import type {
  PosCatalogProduct,
  PosCatalogResponse,
  PosCatalogService,
} from "@cleanhub/api-client";
import type { AsyncKeyValueStorage } from "@cleanhub/offline";

const POS_OFFLINE_CATALOG_NAMESPACE = "cleanhub:pos-catalog:v1";
const POS_OFFLINE_CATALOG_VERSION = 1;
const MAX_CATALOG_AGE_MS = 24 * 60 * 60 * 1000;
// Leave headroom below the Android SQLite key/value record limit so a catalog
// write cannot crowd out the checkout queue, cart, or print spool.
const MAX_CATALOG_BYTES = 1_500_000;

export type PosOfflineCatalogScope = {
  tenantId: string;
  branchId: string;
  terminalId: string;
  currency: string;
};

export type PosOfflineCatalogSnapshot = {
  version: typeof POS_OFFLINE_CATALOG_VERSION;
  updatedAt: string;
  products: PosCatalogProduct[];
  services: PosCatalogService[];
};

type ReadPosOfflineCatalogOptions = {
  maxAgeMs?: number;
  now?: number;
};

type WritePosOfflineCatalogOptions = {
  updatedAt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === "string" || value === null;
}

function isMediaList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (media) =>
        isRecord(media) &&
        typeof media.id === "string" &&
        typeof media.downloadUrl === "string" &&
        typeof media.expiresAt === "string" &&
        typeof media.isPrimary === "boolean" &&
        typeof media.sortOrder === "number",
    )
  );
}

function isCatalogProduct(
  value: unknown,
  currency: string,
): value is PosCatalogProduct {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.productId === "string" &&
    typeof value.productSkuId === "string" &&
    typeof value.productPriceId === "string" &&
    typeof value.name === "string" &&
    isStringOrNull(value.brand) &&
    isStringOrNull(value.description) &&
    isStringOrNull(value.categoryId) &&
    isStringOrNull(value.categoryName) &&
    typeof value.sku === "string" &&
    isStringOrNull(value.barcode) &&
    isStringOrNull(value.variantName) &&
    typeof value.unitOfMeasure === "string" &&
    isStringOrNull(value.unitCostAmount) &&
    typeof value.amount === "string" &&
    value.currency === currency &&
    typeof value.trackInventory === "boolean" &&
    isStringOrNull(value.availableQuantity) &&
    typeof value.allowNegativeStock === "boolean" &&
    typeof value.allowOfflineSale === "boolean" &&
    typeof value.offlineStockBuffer === "string" &&
    isMediaList(value.media)
  );
}

function isCatalogService(
  value: unknown,
  currency: string,
): value is PosCatalogService {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isStringOrNull(value.shortName) &&
    isStringOrNull(value.description) &&
    typeof value.categoryId === "string" &&
    typeof value.categoryName === "string" &&
    typeof value.businessLine === "string" &&
    (value.pricingUnit === "per_item" || value.pricingUnit === "per_kg") &&
    typeof value.labelRule === "string" &&
    Array.isArray(value.applicableItemTypes) &&
    value.applicableItemTypes.every((itemType) => typeof itemType === "string") &&
    (typeof value.turnaroundMinutes === "number" ||
      value.turnaroundMinutes === null) &&
    typeof value.amount === "string" &&
    value.currency === currency &&
    isMediaList(value.media)
  );
}

function isValidSnapshot(
  value: unknown,
  currency: string,
): value is PosOfflineCatalogSnapshot {
  if (!isRecord(value)) return false;
  return (
    value.version === POS_OFFLINE_CATALOG_VERSION &&
    typeof value.updatedAt === "string" &&
    Number.isFinite(Date.parse(value.updatedAt)) &&
    Array.isArray(value.products) &&
    value.products.every((product) => isCatalogProduct(product, currency)) &&
    Array.isArray(value.services) &&
    value.services.every((service) => isCatalogService(service, currency))
  );
}

function withoutMedia<TItem extends { media: unknown[] }>(item: TItem): TItem {
  // Catalog images currently use expiring signed URLs. Persisting them offers
  // no offline image benefit and would retain a credential-bearing URL.
  return { ...item, media: [] };
}

export function buildPosOfflineCatalogStorageKey(
  scope: PosOfflineCatalogScope,
): string {
  return [
    POS_OFFLINE_CATALOG_NAMESPACE,
    scope.tenantId,
    scope.branchId,
    scope.terminalId,
  ].join(":");
}

export async function readPosOfflineCatalog(
  storage: AsyncKeyValueStorage,
  scope: PosOfflineCatalogScope,
  options: ReadPosOfflineCatalogOptions = {},
): Promise<PosOfflineCatalogSnapshot | null> {
  const stored = await storage.getItem(buildPosOfflineCatalogStorageKey(scope));
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!isValidSnapshot(parsed, scope.currency)) return null;
    const now = options.now ?? Date.now();
    const age = now - Date.parse(parsed.updatedAt);
    const maxAgeMs = options.maxAgeMs ?? MAX_CATALOG_AGE_MS;
    if (age < -5 * 60 * 1000 || age > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writePosOfflineCatalog(
  storage: AsyncKeyValueStorage,
  scope: PosOfflineCatalogScope,
  catalog: PosCatalogResponse,
  options: WritePosOfflineCatalogOptions = {},
): Promise<boolean> {
  const snapshot: PosOfflineCatalogSnapshot = {
    version: POS_OFFLINE_CATALOG_VERSION,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    products: catalog.products.map(withoutMedia),
    services: catalog.data.map(withoutMedia),
  };
  const serialized = JSON.stringify(snapshot);
  if (new TextEncoder().encode(serialized).byteLength > MAX_CATALOG_BYTES) {
    return false;
  }
  await storage.setItem(buildPosOfflineCatalogStorageKey(scope), serialized);
  return true;
}
