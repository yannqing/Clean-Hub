import type { AsyncKeyValueStorage } from "@cleanhub/offline";
import type { RelatedOrderSummary } from "@cleanhub/api-client";
import { createId } from "@cleanhub/id";

import type {
  AddProductToCartInput,
  AddTicketToCartInput,
  PosCartCustomer,
  PosCartMutationResult,
  PosCartProductLine,
  PosCartScope,
  PosCartSnapshot,
} from "../cart.types";

const POS_CART_STORAGE_NAMESPACE = "cleanhub:pos-cart:v2";

export function buildPosCartStorageKey(scope: PosCartScope): string {
  return [
    POS_CART_STORAGE_NAMESPACE,
    scope.tenantId,
    scope.branchId,
    scope.terminalId,
    scope.userId ?? "shared",
  ].join(":");
}

export function createEmptyPosCart(currency: string): PosCartSnapshot {
  return {
    version: 2,
    checkoutId: createId(),
    currency,
    customer: null,
    lines: [],
    notes: "",
    discountCode: "",
    discountReason: "",
    updatedAt: new Date().toISOString(),
  };
}

export function selectNewestPosCart(
  local: PosCartSnapshot | null,
  remote: PosCartSnapshot | null,
  currency: string,
): PosCartSnapshot {
  const normalizedLocal = normalizePosCartSnapshot(local, currency);
  const normalizedRemote = normalizePosCartSnapshot(remote, currency);
  if (!normalizedLocal) return normalizedRemote ?? createEmptyPosCart(currency);
  if (!normalizedRemote) return normalizedLocal;
  return Date.parse(normalizedRemote.updatedAt) >
    Date.parse(normalizedLocal.updatedAt)
    ? normalizedRemote
    : normalizedLocal;
}

export function normalizePosCartSnapshot(
  cart: PosCartSnapshot | null,
  currency: string,
): PosCartSnapshot | null {
  if (!cart || cart.version !== 2 || cart.currency !== currency) return null;
  return {
    ...cart,
    checkoutId:
      typeof cart.checkoutId === "string" && cart.checkoutId.length === 26
        ? cart.checkoutId
        : createId(),
  };
}

export async function readPosCart(
  storage: AsyncKeyValueStorage,
  scope: PosCartScope,
  currency: string,
): Promise<PosCartSnapshot> {
  return (
    (await readStoredPosCart(storage, scope, currency)) ??
    createEmptyPosCart(currency)
  );
}

export async function readStoredPosCart(
  storage: AsyncKeyValueStorage,
  scope: PosCartScope,
  currency: string,
): Promise<PosCartSnapshot | null> {
  const stored = await storage.getItem(buildPosCartStorageKey(scope));
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as Partial<PosCartSnapshot>;
    if (
      parsed.version !== 2 ||
      parsed.currency !== currency ||
      !Array.isArray(parsed.lines) ||
      typeof parsed.notes !== "string" ||
      typeof parsed.discountCode !== "string" ||
      typeof parsed.discountReason !== "string"
    ) {
      return null;
    }
    return normalizePosCartSnapshot(parsed as PosCartSnapshot, currency);
  } catch {
    return null;
  }
}

export async function writePosCart(
  storage: AsyncKeyValueStorage,
  scope: PosCartScope,
  cart: PosCartSnapshot,
): Promise<void> {
  await storage.setItem(buildPosCartStorageKey(scope), JSON.stringify(cart));
}

export async function removeStoredPosCart(
  storage: AsyncKeyValueStorage,
  scope: PosCartScope,
): Promise<void> {
  if (storage.removeItem) {
    await storage.removeItem(buildPosCartStorageKey(scope));
    return;
  }
  await storage.setItem(buildPosCartStorageKey(scope), "");
}

export function addProductToPosCart(
  cart: PosCartSnapshot,
  product: AddProductToCartInput,
): PosCartMutationResult {
  if (product.currency !== cart.currency) {
    return unchanged(cart, "商品币种与当前门店币种不一致。");
  }

  const existing = cart.lines.find(
    (line): line is PosCartProductLine =>
      line.kind === "product" && line.productSkuId === product.productSkuId,
  );
  const nextQuantity = (existing?.quantity ?? 0) + 1;
  if (!canUseProductQuantity(product, nextQuantity)) {
    return unchanged(cart, "可用库存不足，无法继续添加该商品。");
  }

  const nextLine: PosCartProductLine = {
    id: `product:${product.productSkuId}`,
    kind: "product",
    productSkuId: product.productSkuId,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    variantName: product.variantName,
    unitOfMeasure: product.unitOfMeasure,
    unitAmount: product.amount,
    currency: product.currency,
    quantity: nextQuantity,
    trackInventory: product.trackInventory,
    availableQuantity: product.availableQuantity,
    allowNegativeStock: product.allowNegativeStock,
    allowOfflineSale: product.allowOfflineSale,
    offlineStockBuffer: product.offlineStockBuffer,
    coverUrl: product.media.find((media) => media.isPrimary)?.downloadUrl ??
      product.media[0]?.downloadUrl ??
      null,
  };

  return changed(cart, {
    lines: existing
      ? cart.lines.map((line) => (line.id === existing.id ? nextLine : line))
      : [...cart.lines, nextLine],
  });
}

export function addTicketToPosCart(
  cart: PosCartSnapshot,
  ticket: AddTicketToCartInput,
  branchId: string,
): PosCartMutationResult {
  if (ticket.branchId !== branchId) {
    return unchanged(cart, "该工单不属于当前门店。");
  }
  if (ticket.currency !== cart.currency) {
    return unchanged(cart, "工单币种与当前门店币种不一致。");
  }
  if (cart.customer && cart.customer.id !== ticket.customerId) {
    return unchanged(cart, "购物车中已有其他客户的项目，请先完成或清空购物车。");
  }
  if (ticket.items.length === 0) {
    return unchanged(cart, "该工单还没有可加入购物车的项目。");
  }

  const existingIds = new Set(cart.lines.map((line) => line.id));
  const ticketCode =
    ticket.ticketNo ?? `TK-${ticket.id.slice(-8).toUpperCase()}`;
  const additions = ticket.items
    .map((item) => ({
      id: `ticket-item:${item.id}`,
      kind: "ticket_item" as const,
      ticketId: ticket.id,
      ticketItemId: item.id,
      ticketCode,
      serviceId: item.serviceId,
      name: item.itemName,
      pricingUnit: item.pricingUnit,
      quantity: item.quantity,
      weight: item.weight,
      bagCount: item.bagCount,
      unitAmount: item.chargedUnitAmount,
      lineAmount: item.lineAmount,
      currency: ticket.currency,
      customerId: ticket.customerId,
      customerName: ticket.customerName,
    }))
    .filter((line) => !existingIds.has(line.id));

  if (additions.length === 0) {
    return unchanged(cart, "该工单的项目已经在购物车中。");
  }

  return changed(cart, {
    customer: {
      id: ticket.customerId,
      name: ticket.customerName,
    },
    lines: [...cart.lines, ...additions],
  });
}

export function setPosCartCustomer(
  cart: PosCartSnapshot,
  customer: PosCartCustomer | null,
): PosCartMutationResult {
  const ticketCustomerId = cart.lines.find(
    (line) => line.kind === "ticket_item",
  )?.customerId;
  if (ticketCustomerId && customer?.id !== ticketCustomerId) {
    return unchanged(cart, "工单项目必须保留其所属客户。");
  }
  return changed(cart, { customer });
}

export function setPosCartProductQuantity(
  cart: PosCartSnapshot,
  lineId: string,
  quantity: number,
): PosCartMutationResult {
  const line = cart.lines.find(
    (candidate): candidate is PosCartProductLine =>
      candidate.id === lineId && candidate.kind === "product",
  );
  if (!line) {
    return unchanged(cart, "购物车商品不存在。");
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    return removePosCartLine(cart, lineId);
  }
  if (!canUseProductQuantity(line, quantity)) {
    return unchanged(cart, "可用库存不足，无法增加数量。");
  }
  return changed(cart, {
    lines: cart.lines.map((candidate) =>
      candidate.id === lineId ? { ...line, quantity } : candidate,
    ),
  });
}

export function removePosCartLine(
  cart: PosCartSnapshot,
  lineId: string,
): PosCartMutationResult {
  const lines = cart.lines.filter((line) => line.id !== lineId);
  if (lines.length === cart.lines.length) {
    return unchanged(cart);
  }
  return changed(cart, { lines });
}

export function setPosCartNotes(
  cart: PosCartSnapshot,
  notes: string,
): PosCartSnapshot {
  return touch({ ...cart, notes });
}

export function setPosCartDiscount(
  cart: PosCartSnapshot,
  input: { code: string; reason: string },
): PosCartSnapshot {
  return touch({
    ...cart,
    discountCode: input.code,
    discountReason: input.reason,
  });
}

export function calculatePosCartTotal(cart: PosCartSnapshot): string {
  const minor = cart.lines.reduce((total, line) => {
    const amount =
      line.kind === "product"
        ? Number(line.unitAmount) * line.quantity
        : Number(line.lineAmount);
    return total + Math.round(amount * 100);
  }, 0);
  return (minor / 100).toFixed(2);
}

export function getTicketItemAvailability(
  ticketId: string,
  relatedOrders: RelatedOrderSummary[],
  cart: PosCartSnapshot,
): { billedIds: Set<string>; cartIds: Set<string> } {
  return {
    billedIds: new Set(
      relatedOrders
        .filter((order) => order.status !== "cancelled")
        .flatMap((order) => order.ticketItemIds ?? []),
    ),
    cartIds: new Set(
      cart.lines.flatMap((line) =>
        line.kind === "ticket_item" && line.ticketId === ticketId
          ? [line.ticketItemId]
          : [],
      ),
    ),
  };
}

function canUseProductQuantity(
  product: Pick<
    PosCartProductLine,
    "trackInventory" | "availableQuantity" | "allowNegativeStock"
  >,
  quantity: number,
): boolean {
  if (!product.trackInventory || product.allowNegativeStock) {
    return true;
  }
  return Number(product.availableQuantity ?? 0) >= quantity;
}

function unchanged(
  cart: PosCartSnapshot,
  message?: string,
): PosCartMutationResult {
  return { cart, changed: false, message };
}

function changed(
  cart: PosCartSnapshot,
  patch: Partial<Pick<PosCartSnapshot, "customer" | "lines">>,
): PosCartMutationResult {
  return { cart: touch({ ...cart, ...patch }), changed: true };
}

function touch(cart: PosCartSnapshot): PosCartSnapshot {
  return { ...cart, updatedAt: new Date().toISOString() };
}
