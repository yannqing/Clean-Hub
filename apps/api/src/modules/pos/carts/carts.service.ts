import { getDb, type Database } from "@cleanhub/db";

import { findBranchById } from "../../tenant/branches/branches.repository.js";
import { requirePosTerminalContext } from "../access-control.helper.js";
import { findPosCatalogServiceById } from "../catalog/catalog.repository.js";
import {
  minorToMoney,
  moneyToMinor,
} from "../discounts/pricing-engine.js";
import { previewPosDiscountPricing } from "../discounts/discounts.service.js";
import { PosOrderError } from "../orders/orders.errors.js";
import {
  calculatePosOrderItemLineAmount,
  countAlreadyOrderedTicketItems,
  findCustomerForOrder,
  findServiceTicketForOrder,
  findTicketItemsForOrder,
} from "../orders/orders.repository.js";
import {
  assertGuestOrderItemAllowed,
  resolveOrderItemPricing,
} from "../orders/orders.service.js";
import {
  effectiveLineTaxRate,
  resolveCatalogTaxRates,
} from "../../tax/tax.rates.js";
import {
  calculatePosFinancialTotals,
  financialTotalsToMoney,
  resolvePosFinancialRules,
} from "../orders/orders.financial.js";
import type { CreateManualOrderItemRequest } from "../orders/orders.types.js";
import {
  abandonActivePosCart,
  claimParkedPosCart,
  expirePosCarts,
  findActivePosCart,
  findParkedPosCartForUpdate,
  getPosCartRetentionHours,
  insertPosCart,
  listParkedPosCarts,
  lockPosCartScope,
  parkActivePosCart,
  updatePosCart,
} from "./carts.repository.js";
import type {
  PosCartPricePreview,
  PosCartRequestInput,
  PosCartSnapshot,
  PosSavedCart,
  ClaimPosCartRequest,
  ParkPosCartRequest,
  PreviewPosCartRequest,
} from "./carts.types.js";

function isTicketItemReference(
  item: CreateManualOrderItemRequest,
): item is Extract<CreateManualOrderItemRequest, { ticketId: string }> {
  return item.ticketId !== undefined;
}

function assertReasonableClientTimestamp(value: string): void {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || timestamp > Date.now() + 5 * 60_000) {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "The cart update timestamp is invalid or too far in the future.",
      422,
    );
  }
}

/**
 * Clamps a terminal's own clock reading to server time.
 *
 * Carts are merged by comparing `clientUpdatedAt`, so a terminal running fast
 * — even by less than the 5 minutes `assertReasonableClientTimestamp` tolerates
 * — would otherwise store a future timestamp that no correctly-clocked terminal
 * can beat, and every later write from its colleagues would be silently
 * rejected until real time caught up. Clamping keeps ordering intact between
 * honest terminals while denying a skewed one a permanent advantage.
 */
export function clampClientTimestampToServer(
  value: string,
  now: number = Date.now(),
): string {
  const timestamp = new Date(value).getTime();
  return timestamp > now ? new Date(now).toISOString() : value;
}

export function shouldAcceptPosCartUpdate(
  existingClientUpdatedAt: string | null,
  incomingClientUpdatedAt: string,
): boolean {
  return (
    existingClientUpdatedAt === null ||
    Date.parse(incomingClientUpdatedAt) >=
      Date.parse(existingClientUpdatedAt)
  );
}

export async function getCurrentPosCart(
  authContext: PosCartRequestInput<never>["authContext"],
  db: Database = getDb(),
): Promise<PosSavedCart | null> {
  const terminal = requirePosTerminalContext(authContext);
  return db.transaction(async (tx) => {
    const scope = {
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      userId: authContext.userId,
    };
    await lockPosCartScope(tx, scope);
    const cart = await findActivePosCart(tx, scope);
    if (!cart) return null;
    if (Date.parse(cart.expiresAt) <= Date.now()) {
      await abandonActivePosCart(tx, scope);
      return null;
    }
    return cart;
  });
}

export async function saveCurrentPosCart(
  input: PosCartRequestInput<{ cart: PosCartSnapshot }>,
  db: Database = getDb(),
): Promise<{ accepted: boolean; cart: PosSavedCart }> {
  const terminal = requirePosTerminalContext(input.authContext);
  assertReasonableClientTimestamp(input.data.cart.updatedAt);
  const branch = await findBranchById(db, {
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
  });
  if (!branch || branch.status !== "active") {
    throw new PosOrderError(
      "BRANCH_NOT_ALLOWED",
      "The terminal branch is not active.",
      422,
    );
  }
  if (input.data.cart.currency !== branch.defaultCurrency) {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "The cart currency does not match the terminal branch currency.",
      422,
    );
  }

  // Never let a terminal's own clock run ahead of the server's: the merge rule
  // below orders by this value, so a future-dated write would suppress every
  // later update from a correctly-clocked terminal.
  const incomingCart = {
    ...input.data.cart,
    updatedAt: clampClientTimestampToServer(input.data.cart.updatedAt),
  };

  return db.transaction(async (tx) => {
    const scope = {
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      userId: input.authContext.userId,
    };
    await lockPosCartScope(tx, scope);
    const existing = await findActivePosCart(tx, scope);
    if (
      existing &&
      !shouldAcceptPosCartUpdate(
        existing.clientUpdatedAt,
        incomingCart.updatedAt,
      )
    ) {
      return { accepted: false, cart: existing };
    }
    const retentionHours = await getPosCartRetentionHours(
      tx,
      terminal.tenantId,
    );
    const expiresAt = new Date(Date.now() + retentionHours * 60 * 60_000);
    const cart = existing
      ? await updatePosCart(tx, {
          id: existing.id,
          tenantId: terminal.tenantId,
          terminalId: terminal.terminalId,
          userId: input.authContext.userId,
          cart: incomingCart,
          expiresAt,
        })
      : await insertPosCart(tx, {
          tenantId: terminal.tenantId,
          branchId: terminal.branchId,
          terminalId: terminal.terminalId,
          userId: input.authContext.userId,
          cart: incomingCart,
          expiresAt,
        });
    return { accepted: true, cart };
  });
}

export async function clearCurrentPosCart(
  authContext: PosCartRequestInput<never>["authContext"],
  db: Database = getDb(),
): Promise<void> {
  const terminal = requirePosTerminalContext(authContext);
  await db.transaction(async (tx) => {
    const scope = {
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      userId: authContext.userId,
    };
    await lockPosCartScope(tx, scope);
    await abandonActivePosCart(tx, scope);
  });
}

export async function listParkedCarts(
  authContext: PosCartRequestInput<never>["authContext"],
  db: Database = getDb(),
): Promise<{ data: PosSavedCart[] }> {
  const terminal = requirePosTerminalContext(authContext);
  const now = new Date();
  await expirePosCarts(db, {
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
    now,
  });
  return {
    data: await listParkedPosCarts(db, {
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      now,
    }),
  };
}

export async function parkCurrentPosCart(
  input: PosCartRequestInput<ParkPosCartRequest>,
  db: Database = getDb(),
): Promise<PosSavedCart> {
  const terminal = requirePosTerminalContext(input.authContext);
  return db.transaction(async (tx) => {
    const scope = {
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      userId: input.authContext.userId,
    };
    await lockPosCartScope(tx, scope);
    const current = await findActivePosCart(tx, scope);
    if (!current || current.cart.lines.length === 0) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "Only a non-empty active cart can be parked.",
        422,
      );
    }
    const parked = await parkActivePosCart(tx, {
      ...scope,
      name: input.data.name,
      handoffNote: input.data.handoffNote,
    });
    if (!parked) {
      throw new PosOrderError(
        "VERSION_CONFLICT",
        "The active cart changed before it could be parked.",
        409,
      );
    }
    return parked;
  });
}

export async function claimParkedCart(
  input: PosCartRequestInput<ClaimPosCartRequest> & { cartId: string },
  db: Database = getDb(),
): Promise<PosSavedCart> {
  const terminal = requirePosTerminalContext(input.authContext);
  return db.transaction(async (tx) => {
    const scope = {
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      userId: input.authContext.userId,
    };
    await lockPosCartScope(tx, scope);
    const parked = await findParkedPosCartForUpdate(tx, {
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      cartId: input.cartId,
    });
    if (!parked || Date.parse(parked.expiresAt) <= Date.now()) {
      throw new PosOrderError(
        "ORDER_NOT_FOUND",
        "The parked cart was not found or has expired.",
        404,
      );
    }
    const active = await findActivePosCart(tx, scope);
    if (active?.cart.lines.length) {
      throw new PosOrderError(
        "VALIDATION_ERROR",
        "Park or clear the current cart before claiming another cart.",
        422,
      );
    }
    if (active) await abandonActivePosCart(tx, scope);
    const claimed = await claimParkedPosCart(tx, {
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      cartId: input.cartId,
      terminalId: terminal.terminalId,
      userId: input.authContext.userId,
      handoffNote: input.data.handoffNote,
    });
    if (!claimed) {
      throw new PosOrderError(
        "VERSION_CONFLICT",
        "The parked cart was claimed by another operator.",
        409,
      );
    }
    return claimed;
  });
}

export async function previewCurrentPosCart(
  input: PosCartRequestInput<PreviewPosCartRequest>,
  db: Database = getDb(),
): Promise<PosCartPricePreview> {
  const terminal = requirePosTerminalContext(input.authContext);
  if (input.data.branchId !== terminal.branchId) {
    throw new PosOrderError(
      "BRANCH_NOT_ALLOWED",
      "The cart branch does not match the enrolled terminal.",
      403,
    );
  }
  const branch = await findBranchById(db, {
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
  });
  if (!branch || branch.status !== "active") {
    throw new PosOrderError("BRANCH_NOT_ALLOWED", "Branch was not found.", 404);
  }

  let customerId = input.data.customerId ?? null;
  const ticketReferences = input.data.items.filter(isTicketItemReference);
  const ticketItemIds = ticketReferences.map((item) => item.ticketItemId);
  if (new Set(ticketItemIds).size !== ticketItemIds.length) {
    throw new PosOrderError(
      "VALIDATION_ERROR",
      "A ticket item cannot appear in the cart more than once.",
      422,
    );
  }
  if (ticketItemIds.length > 0) {
    const alreadyOrdered = await countAlreadyOrderedTicketItems(db, {
      tenantId: terminal.tenantId,
      ticketItemIds,
    });
    if (alreadyOrdered > 0) {
      throw new PosOrderError(
        "TICKET_ITEM_ALREADY_ORDERED",
        "One or more ticket items are already linked to an order.",
        409,
      );
    }
  }

  const resolvedLines: PosCartPricePreview["lines"] = [];
  const pricingLines = [] as Parameters<typeof previewPosDiscountPricing>[1]["lines"];

  for (const [index, item] of input.data.items.entries()) {
    const lineId = `cart-line-${index}`;
    if (isTicketItemReference(item)) {
      const ticket = await findServiceTicketForOrder(db, {
        tenantId: terminal.tenantId,
        ticketId: item.ticketId,
      });
      if (!ticket || ticket.branchId !== terminal.branchId) {
        throw new PosOrderError(
          "SERVICE_TICKET_NOT_FOUND",
          "The selected service ticket was not found at this branch.",
          404,
        );
      }
      if (ticket.currency !== branch.defaultCurrency) {
        throw new PosOrderError(
          "VALIDATION_ERROR",
          "The ticket currency does not match the branch currency.",
          422,
        );
      }
      if (customerId && customerId !== ticket.customerId) {
        throw new PosOrderError(
          "VALIDATION_ERROR",
          "All ticket items in a cart must belong to the same customer.",
          422,
        );
      }
      customerId ??= ticket.customerId;
      const ticketItems = await findTicketItemsForOrder(db, {
        tenantId: terminal.tenantId,
        ticketId: item.ticketId,
        ticketItemIds: [item.ticketItemId],
      });
      const ticketItem = ticketItems[0];
      if (!ticketItem) {
        throw new PosOrderError(
          "SERVICE_TICKET_EMPTY",
          "The selected ticket item was not found.",
          404,
        );
      }
      const catalogService = ticketItem.serviceId
        ? await findPosCatalogServiceById(db, {
            tenantId: terminal.tenantId,
            branchId: terminal.branchId,
            serviceId: ticketItem.serviceId,
          })
        : null;
      const pricingUnit = ticketItem.pricingUnit ?? "per_item";
      const unitAmount =
        ticketItem.chargedUnitAmount ?? ticketItem.unitAmount;
      resolvedLines.push({
        id: lineId,
        itemKind: "service",
        itemName: ticketItem.itemName,
        quantity: String(ticketItem.quantity),
        pricingUnit,
        weight: ticketItem.weight,
        unitAmount,
        lineAmount: ticketItem.lineAmount,
      });
      pricingLines.push({
        id: lineId,
        itemKind: "service",
        lineAmount: ticketItem.lineAmount,
        quantity: String(ticketItem.quantity),
        weight: ticketItem.weight,
        pricingUnit,
        serviceId: ticketItem.serviceId,
        serviceCategoryId: catalogService?.categoryId ?? null,
        productId: null,
        productCategoryId: null,
      });
      continue;
    }

    const resolved = await resolveOrderItemPricing(db, {
      authContext: input.authContext,
      tenantId: terminal.tenantId,
      branchId: terminal.branchId,
      currency: branch.defaultCurrency,
      data: item,
    });
    assertGuestOrderItemAllowed(customerId, resolved.itemKind);
    const lineAmount = calculatePosOrderItemLineAmount(resolved);
    resolvedLines.push({
      id: lineId,
      itemKind: resolved.itemKind,
      itemName: resolved.itemName,
      quantity: resolved.quantity,
      pricingUnit: resolved.pricingUnit,
      weight: resolved.weight,
      unitAmount: resolved.chargedUnitAmount,
      lineAmount,
    });
    pricingLines.push({
      id: lineId,
      itemKind: resolved.itemKind,
      lineAmount,
      quantity: resolved.quantity,
      weight: resolved.weight,
      pricingUnit: resolved.pricingUnit,
      serviceId: resolved.serviceId,
      serviceCategoryId: resolved.serviceCategoryId,
      productId: resolved.productId,
      productCategoryId: resolved.productCategoryId,
    });
  }

  if (customerId) {
    const customer = await findCustomerForOrder(db, {
      tenantId: terminal.tenantId,
      customerId,
    });
    if (!customer || customer.status !== "active") {
      throw new PosOrderError(
        "CUSTOMER_DISABLED",
        "The selected customer is not active.",
        422,
      );
    }
  }
  const selections = await previewPosDiscountPricing(db, {
    tenantId: terminal.tenantId,
    branchId: terminal.branchId,
    customerId,
    currency: branch.defaultCurrency,
    lines: pricingLines,
    code: input.data.discountCode,
  });
  const subtotalMinor = resolvedLines.reduce(
    (sum, line) => sum + moneyToMinor(line.lineAmount),
    BigInt(0),
  );
  const discountMinor = selections.reduce(
    (sum, selection) => sum + selection.result.amountMinor,
    BigInt(0),
  );
  const rules = await resolvePosFinancialRules(
    db,
    input.authContext,
    terminal.tenantId,
    branch.defaultCurrency,
  );
  // Price each line at its own rate, exactly as checkout will, so the total the
  // cashier quotes is the total the order is saved with.
  const catalogRates = await resolveCatalogTaxRates(db, {
    tenantId: terminal.tenantId,
    serviceIds: pricingLines.map((line) => line.serviceId),
    productIds: pricingLines.map((line) => line.productId),
  });
  const discountByLine = new Map<string, bigint>();
  for (const selection of selections) {
    for (const allocation of selection.result.allocations) {
      discountByLine.set(
        allocation.orderItemId,
        (discountByLine.get(allocation.orderItemId) ?? BigInt(0)) + allocation.amountMinor,
      );
    }
  }
  const financialLines = pricingLines.map((line) => ({
    key: line.id,
    grossMinor: moneyToMinor(line.lineAmount),
    taxRate: effectiveLineTaxRate(catalogRates, line, rules.taxRate),
    discountMinor: discountByLine.get(line.id),
  }));
  const financialTotals = calculatePosFinancialTotals({
    subtotalMinor,
    discountMinor,
    rules,
    taxExemptionReason: input.data.taxExemptionReason,
    lines: financialLines,
  });
  const lineTaxRates = new Map(
    financialTotals.lineTaxes.map((line) => [line.key, line.taxRate]),
  );
  const financial = financialTotalsToMoney(financialTotals);
  return {
    currency: branch.defaultCurrency,
    lines: resolvedLines.map((line) => ({
      ...line,
      taxRate: lineTaxRates.get(line.id) ?? "0.0000",
    })),
    discounts: selections.map(({ rule, result }) => ({
      discountId: rule.id,
      title: rule.title,
      code: rule.code,
      method: rule.method,
      amount: minorToMoney(result.amountMinor),
    })),
    subtotalAmount: minorToMoney(subtotalMinor),
    discountAmount: minorToMoney(discountMinor),
    ...financial,
    calculatedAt: new Date().toISOString(),
  };
}
