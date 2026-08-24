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
import type { CreateManualOrderItemRequest } from "../orders/orders.types.js";
import {
  abandonActivePosCart,
  findActivePosCart,
  getPosCartRetentionHours,
  insertPosCart,
  lockPosCartScope,
  updatePosCart,
} from "./carts.repository.js";
import type {
  PosCartPricePreview,
  PosCartRequestInput,
  PosCartSnapshot,
  PosSavedCart,
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
        input.data.cart.updatedAt,
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
          cart: input.data.cart,
          expiresAt,
        })
      : await insertPosCart(tx, {
          tenantId: terminal.tenantId,
          branchId: terminal.branchId,
          terminalId: terminal.terminalId,
          userId: input.authContext.userId,
          cart: input.data.cart,
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
  return {
    currency: branch.defaultCurrency,
    lines: resolvedLines,
    discounts: selections.map(({ rule, result }) => ({
      discountId: rule.id,
      title: rule.title,
      code: rule.code,
      method: rule.method,
      amount: minorToMoney(result.amountMinor),
    })),
    subtotalAmount: minorToMoney(subtotalMinor),
    discountAmount: minorToMoney(discountMinor),
    totalAmount: minorToMoney(subtotalMinor - discountMinor),
    calculatedAt: new Date().toISOString(),
  };
}
