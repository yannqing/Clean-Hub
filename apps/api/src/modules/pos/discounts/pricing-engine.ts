import type {
  PosDiscountPricingAllocation,
  PosDiscountPricingContext,
  PosDiscountPricingLine,
  PosDiscountPricingResult,
  PosDiscountRule,
  PosDiscountTarget,
  PosDiscountType,
} from "./discounts.types.js";

const MONEY_SCALE = BigInt(100);
const QUANTITY_SCALE = BigInt(1_000);
const PERCENT_SCALE = BigInt(10_000);

function parseScaledDecimal(
  value: string,
  scale: bigint,
  decimalPlaces: number,
): bigint {
  const normalized = value.trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match || (match[2]?.length ?? 0) > decimalPlaces) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  const fraction = (match[2] ?? "").padEnd(decimalPlaces, "0");
  return BigInt(match[1] ?? "0") * scale + BigInt(fraction || "0");
}

export function moneyToMinor(value: string): bigint {
  return parseScaledDecimal(value, MONEY_SCALE, 2);
}

export function minorToMoney(value: bigint): string {
  if (value < BigInt(0)) {
    throw new Error("Money cannot be negative.");
  }
  return `${value / MONEY_SCALE}.${(value % MONEY_SCALE)
    .toString()
    .padStart(2, "0")}`;
}

export function quantityToMillis(value: string): bigint {
  return parseScaledDecimal(value, QUANTITY_SCALE, 3);
}

function percentageToHundredths(value: string): bigint {
  const percentage = parseScaledDecimal(value, BigInt(100), 2);
  if (percentage <= BigInt(0) || percentage > PERCENT_SCALE) {
    throw new Error("Percentage must be greater than 0 and at most 100.");
  }
  return percentage;
}

function roundRatio(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt(0)) {
    return BigInt(0);
  }
  return (numerator + denominator / BigInt(2)) / denominator;
}

function effectiveQuantity(line: PosDiscountPricingLine): bigint {
  if (line.pricingUnit === "per_kg" && line.weight) {
    return quantityToMillis(line.weight);
  }
  return quantityToMillis(line.quantity);
}

function targetMatches(
  line: PosDiscountPricingLine,
  target: PosDiscountTarget,
): boolean {
  switch (target.targetType) {
    case "product":
      return line.itemKind === "product" && line.productId === target.targetId;
    case "product_category":
      return (
        line.itemKind === "product" &&
        line.productCategoryId === target.targetId
      );
    case "service":
      return line.itemKind === "service" && line.serviceId === target.targetId;
    case "service_category":
      return (
        line.itemKind === "service" &&
        line.serviceCategoryId === target.targetId
      );
  }
}

function linesForRole(
  context: PosDiscountPricingContext,
  rule: PosDiscountRule,
  role: PosDiscountTarget["role"],
): PosDiscountPricingLine[] {
  const targets = rule.targets.filter((target) => target.role === role);
  if (targets.length === 0) {
    return context.lines.filter((line) => line.itemKind !== "delivery_fee");
  }
  return context.lines.filter((line) =>
    targets.some((target) => targetMatches(line, target)),
  );
}

function remainingAmount(
  context: PosDiscountPricingContext,
  line: PosDiscountPricingLine,
): bigint {
  const gross = moneyToMinor(line.lineAmount);
  const remaining = context.remainingByLine?.get(line.id);
  if (remaining === undefined) {
    return gross;
  }
  return remaining < BigInt(0)
    ? BigInt(0)
    : remaining > gross
      ? gross
      : remaining;
}

function sumAmounts(
  context: PosDiscountPricingContext,
  lines: PosDiscountPricingLine[],
): bigint {
  return lines.reduce(
    (total, line) => total + remainingAmount(context, line),
    BigInt(0),
  );
}

function sumQuantities(lines: PosDiscountPricingLine[]): bigint {
  return lines.reduce(
    (total, line) => total + effectiveQuantity(line),
    BigInt(0),
  );
}

function meetsMinimum(
  context: PosDiscountPricingContext,
  rule: PosDiscountRule,
  eligibleLines: PosDiscountPricingLine[],
): boolean {
  if (rule.minimumRequirement === "minimum_amount") {
    return (
      rule.minimumPurchaseAmount !== null &&
      sumAmounts(context, eligibleLines) >=
        moneyToMinor(rule.minimumPurchaseAmount)
    );
  }
  if (rule.minimumRequirement === "minimum_quantity") {
    return (
      rule.minimumQuantity !== null &&
      sumQuantities(eligibleLines) >= quantityToMillis(rule.minimumQuantity)
    );
  }
  return true;
}

function allocateProportionally(
  total: bigint,
  lines: Array<{ id: string; basis: bigint }>,
): PosDiscountPricingAllocation[] {
  const positive = lines.filter((line) => line.basis > BigInt(0));
  const basisTotal = positive.reduce(
    (sum, line) => sum + line.basis,
    BigInt(0),
  );
  const cappedTotal = total > basisTotal ? basisTotal : total;
  if (cappedTotal <= BigInt(0) || basisTotal <= BigInt(0)) {
    return [];
  }

  const provisional = positive.map((line) => {
    const numerator = cappedTotal * line.basis;
    return {
      id: line.id,
      basis: line.basis,
      amount: numerator / basisTotal,
      remainder: numerator % basisTotal,
    };
  });
  let unallocated =
    cappedTotal -
    provisional.reduce((sum, allocation) => sum + allocation.amount, BigInt(0));

  provisional.sort((left, right) =>
    left.remainder === right.remainder
      ? left.id.localeCompare(right.id)
      : left.remainder > right.remainder
        ? -1
        : 1,
  );
  for (const allocation of provisional) {
    if (unallocated <= BigInt(0)) {
      break;
    }
    if (allocation.amount < allocation.basis) {
      allocation.amount += BigInt(1);
      unallocated -= BigInt(1);
    }
  }

  return provisional
    .filter((allocation) => allocation.amount > BigInt(0))
    .map((allocation) => ({
      orderItemId: allocation.id,
      amountMinor: allocation.amount,
    }))
    .sort((left, right) => left.orderItemId.localeCompare(right.orderItemId));
}

function priceAmountOff(
  context: PosDiscountPricingContext,
  rule: PosDiscountRule,
  lines: PosDiscountPricingLine[],
): PosDiscountPricingResult | null {
  if (!meetsMinimum(context, rule, lines)) {
    return null;
  }
  const bases = lines.map((line) => ({
    id: line.id,
    basis: remainingAmount(context, line),
  }));
  const available = bases.reduce((sum, line) => sum + line.basis, BigInt(0));
  if (available <= BigInt(0) || rule.valueAmount === null) {
    return null;
  }

  let allocations: PosDiscountPricingAllocation[];
  if (rule.valueType === "percentage") {
    const percentage = percentageToHundredths(rule.valueAmount);
    const totalDiscount = roundRatio(available * percentage, PERCENT_SCALE);
    allocations = allocateProportionally(totalDiscount, bases);
  } else if (rule.valueType === "fixed_amount") {
    allocations = allocateProportionally(moneyToMinor(rule.valueAmount), bases);
  } else {
    return null;
  }

  const amountMinor = allocations.reduce(
    (sum, allocation) => sum + allocation.amountMinor,
    BigInt(0),
  );
  return amountMinor > BigInt(0)
    ? { discountId: rule.id, amountMinor, allocations }
    : null;
}

function sameTargetSet(
  rule: PosDiscountRule,
  leftRole: PosDiscountTarget["role"],
  rightRole: PosDiscountTarget["role"],
): boolean {
  const serialize = (role: PosDiscountTarget["role"]) =>
    rule.targets
      .filter((target) => target.role === role)
      .map((target) => `${target.targetType}:${target.targetId}`)
      .sort()
      .join("|");
  return serialize(leftRole) === serialize(rightRole);
}

function priceBuyXGetY(
  context: PosDiscountPricingContext,
  rule: PosDiscountRule,
): PosDiscountPricingResult | null {
  if (
    rule.buyRequirementType === null ||
    rule.buyRequirementValue === null ||
    rule.getQuantity === null
  ) {
    return null;
  }

  const buyLines = linesForRole(context, rule, "customer_buys");
  const getLines = linesForRole(context, rule, "customer_gets");
  if (!meetsMinimum(context, rule, buyLines)) {
    return null;
  }

  const getPerUse = quantityToMillis(rule.getQuantity);
  if (getPerUse <= BigInt(0)) {
    return null;
  }

  let uses: bigint;
  if (rule.buyRequirementType === "minimum_amount") {
    const requirement = moneyToMinor(rule.buyRequirementValue);
    uses =
      requirement > BigInt(0)
        ? sumAmounts(context, buyLines) / requirement
        : BigInt(0);
  } else {
    const requirement = quantityToMillis(rule.buyRequirementValue);
    const available = sumQuantities(buyLines);
    const divisor = sameTargetSet(rule, "customer_buys", "customer_gets")
      ? requirement + getPerUse
      : requirement;
    uses = divisor > BigInt(0) ? available / divisor : BigInt(0);
  }
  if (rule.maxUsesPerOrder !== null) {
    const maximum = BigInt(rule.maxUsesPerOrder);
    uses = uses > maximum ? maximum : uses;
  }
  if (uses <= BigInt(0)) {
    return null;
  }

  let rewardQuantity = uses * getPerUse;
  const rewardLines = getLines
    .map((line) => {
      const quantity = effectiveQuantity(line);
      const remaining = remainingAmount(context, line);
      return {
        line,
        quantity,
        remaining,
        unitNumerator: remaining * QUANTITY_SCALE,
      };
    })
    .filter(
      (entry) =>
        entry.quantity > BigInt(0) &&
        entry.remaining > BigInt(0) &&
        rewardQuantity > BigInt(0),
    )
    .sort((left, right) => {
      const comparison =
        left.unitNumerator * right.quantity -
        right.unitNumerator * left.quantity;
      return comparison === BigInt(0)
        ? left.line.id.localeCompare(right.line.id)
        : comparison < BigInt(0)
          ? -1
          : 1;
    });

  const allocations: PosDiscountPricingAllocation[] = [];
  const percentage =
    rule.valueType === "percentage" && rule.valueAmount !== null
      ? percentageToHundredths(rule.valueAmount)
      : null;
  const fixedPerUnit =
    rule.valueType === "fixed_amount" && rule.valueAmount !== null
      ? moneyToMinor(rule.valueAmount)
      : null;

  for (const entry of rewardLines) {
    if (rewardQuantity <= BigInt(0)) {
      break;
    }
    const selected =
      entry.quantity < rewardQuantity ? entry.quantity : rewardQuantity;
    const selectedGross = roundRatio(
      entry.remaining * selected,
      entry.quantity,
    );
    let discount = selectedGross;
    if (percentage !== null) {
      discount = roundRatio(selectedGross * percentage, PERCENT_SCALE);
    } else if (fixedPerUnit !== null) {
      discount = roundRatio(fixedPerUnit * selected, QUANTITY_SCALE);
      if (discount > selectedGross) {
        discount = selectedGross;
      }
    } else if (rule.valueType !== "free") {
      return null;
    }
    if (discount > BigInt(0)) {
      allocations.push({
        orderItemId: entry.line.id,
        amountMinor: discount,
      });
    }
    rewardQuantity -= selected;
  }

  const amountMinor = allocations.reduce(
    (sum, allocation) => sum + allocation.amountMinor,
    BigInt(0),
  );
  return amountMinor > BigInt(0)
    ? { discountId: rule.id, amountMinor, allocations }
    : null;
}

function hasValidTargetRoles(rule: PosDiscountRule): boolean {
  const appliesTo = rule.targets.filter(
    (target) => target.role === "applies_to",
  );
  const customerBuys = rule.targets.filter(
    (target) => target.role === "customer_buys",
  );
  const customerGets = rule.targets.filter(
    (target) => target.role === "customer_gets",
  );

  if (rule.type === "amount_off_items") {
    return (
      appliesTo.length > 0 &&
      customerBuys.length === 0 &&
      customerGets.length === 0
    );
  }
  if (rule.type === "buy_x_get_y") {
    return (
      appliesTo.length === 0 &&
      customerBuys.length > 0 &&
      customerGets.length > 0
    );
  }
  return rule.targets.length === 0;
}

export function pricePosDiscount(
  context: PosDiscountPricingContext,
  rule: PosDiscountRule,
): PosDiscountPricingResult | null {
  if (!hasValidTargetRoles(rule)) {
    return null;
  }
  if (rule.currency !== null && rule.currency !== context.currency) {
    return null;
  }
  if (rule.usageLimit !== null && rule.usageCount >= rule.usageLimit) {
    return null;
  }
  if (rule.oncePerCustomer && rule.customerUsageCount > 0) {
    return null;
  }

  if (rule.type === "amount_off_items") {
    return priceAmountOff(
      context,
      rule,
      linesForRole(context, rule, "applies_to"),
    );
  }
  if (rule.type === "amount_off_order") {
    // Shipping is a separate discount class. An order-level discount applies
    // only to merchandise/services; free_shipping owns delivery fee lines.
    return priceAmountOff(
      context,
      rule,
      context.lines.filter((line) => line.itemKind !== "delivery_fee"),
    );
  }
  if (rule.type === "buy_x_get_y") {
    return priceBuyXGetY(context, rule);
  }
  if (rule.type === "free_shipping") {
    if (rule.countryScope !== "all") {
      return null;
    }
    const shippingLines = context.lines.filter(
      (line) => line.itemKind === "delivery_fee",
    );
    const purchaseLines = context.lines.filter(
      (line) => line.itemKind !== "delivery_fee",
    );
    if (
      !meetsMinimum(context, rule, purchaseLines) ||
      shippingLines.length === 0
    ) {
      return null;
    }
    const maximum =
      rule.maximumShippingPrice === null
        ? null
        : moneyToMinor(rule.maximumShippingPrice);
    const allocations = shippingLines
      .map((line) => ({
        orderItemId: line.id,
        amountMinor: remainingAmount(context, line),
      }))
      .filter(
        (allocation) =>
          allocation.amountMinor > BigInt(0) &&
          (maximum === null || allocation.amountMinor <= maximum),
      );
    const amountMinor = allocations.reduce(
      (sum, allocation) => sum + allocation.amountMinor,
      BigInt(0),
    );
    return amountMinor > BigInt(0)
      ? { discountId: rule.id, amountMinor, allocations }
      : null;
  }
  return null;
}

type DiscountClass = "item" | "order" | "shipping";

function discountClass(type: PosDiscountType): DiscountClass {
  if (type === "amount_off_order") {
    return "order";
  }
  if (type === "free_shipping") {
    return "shipping";
  }
  return "item";
}

function allows(rule: PosDiscountRule, otherClass: DiscountClass): boolean {
  if (otherClass === "item") {
    return rule.combinesWithItemDiscounts;
  }
  if (otherClass === "order") {
    return rule.combinesWithOrderDiscounts;
  }
  return rule.combinesWithShippingDiscounts;
}

export function discountsCanCombine(
  left: PosDiscountRule,
  right: PosDiscountRule,
): boolean {
  return (
    allows(left, discountClass(right.type)) &&
    allows(right, discountClass(left.type))
  );
}
