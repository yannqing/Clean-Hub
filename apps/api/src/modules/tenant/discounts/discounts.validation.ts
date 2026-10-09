import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

const ulidSchema = z.string().regex(ULID_PATTERN);

export const discountMethodSchema = z.enum(["code", "automatic"]);
export const discountTypeSchema = z.enum([
  "amount_off_items",
  "buy_x_get_y",
  "amount_off_order",
  "free_shipping",
]);
export const discountValueTypeSchema = z.enum([
  "percentage",
  "fixed_amount",
  "free",
]);
export const discountEligibilitySchema = z.enum([
  "all_customers",
  "specific_customers",
]);
export const discountMinimumRequirementSchema = z.enum([
  "none",
  "minimum_amount",
  "minimum_quantity",
]);
export const discountPurchaseRequirementSchema = z.enum([
  "minimum_amount",
  "minimum_quantity",
]);
export const discountTargetRoleSchema = z.enum([
  "applies_to",
  "customer_buys",
  "customer_gets",
]);
export const discountTargetTypeSchema = z.enum([
  "product",
  "product_category",
  "service",
  "service_category",
]);
export const discountCountryScopeSchema = z.enum(["all", "selected"]);
export const discountDerivedStatusSchema = z.enum([
  "active",
  "scheduled",
  "expired",
  "inactive",
]);
export const discountListSortSchema = z.enum([
  "created_desc",
  "created_asc",
  "updated_desc",
  "title_asc",
  "title_desc",
  "starts_at_desc",
  "usage_desc",
]);

const isoTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Invalid ISO timestamp.",
  );

function decimalSchema(input: {
  scale: number;
  integerDigits: number;
  label: string;
}) {
  const pattern = new RegExp(
    `^(?:0|[1-9]\\d{0,${input.integerDigits - 1}})(?:\\.\\d{1,${input.scale}})?$`,
  );

  return z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .refine((value) => pattern.test(value), `${input.label} is invalid.`)
    .refine(
      (value) => Number(value) > 0,
      `${input.label} must be greater than zero.`,
    );
}

const moneySchema = decimalSchema({
  scale: 2,
  integerDigits: 12,
  label: "Amount",
});
const quantitySchema = decimalSchema({
  scale: 3,
  integerDigits: 11,
  label: "Quantity",
});

function uniqueStringArraySchema(
  itemSchema: z.ZodType<string>,
  maximum: number,
) {
  return z
    .array(itemSchema)
    .max(maximum)
    .transform((values) => [...new Set(values)]);
}

const branchIdsSchema = uniqueStringArraySchema(ulidSchema, 200);
const customerIdsSchema = uniqueStringArraySchema(ulidSchema, 200);
const countryCodesSchema = uniqueStringArraySchema(
  z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().regex(COUNTRY_CODE_PATTERN)),
  250,
);
const tagsSchema = z
  .array(z.string().trim().min(1).max(60))
  .max(20)
  .transform((values) => {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const value of values) {
      const key = value.toLocaleLowerCase();
      if (!seen.has(key)) {
        result.push(value);
        seen.add(key);
      }
    }

    return result;
  });

const targetSchema = z
  .object({
    role: discountTargetRoleSchema,
    targetType: discountTargetTypeSchema,
    targetId: ulidSchema,
  })
  .strict();

const targetsSchema = z
  .array(targetSchema)
  .max(400)
  .superRefine((targets, context) => {
    const seen = new Set<string>();

    targets.forEach((target, index) => {
      const key = `${target.role}:${target.targetType}:${target.targetId}`;
      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Discount targets must be unique.",
          path: [index],
        });
      }
      seen.add(key);
    });
  });

const channelsSchema = z
  .object({
    posEnabled: z.boolean(),
    customerMobileEnabled: z.boolean(),
    deliveryEnabled: z.boolean(),
  })
  .strict();

const nullableMoneySchema = moneySchema.nullable();
const nullableQuantitySchema = quantitySchema.nullable();
const nullableCurrencySchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(z.string().regex(CURRENCY_PATTERN))
  .nullable();

export const discountBodyShapeSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    method: discountMethodSchema,
    type: discountTypeSchema,
    enabled: z.boolean().default(true),
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{2,100}$/)
      .transform((value) => value.toUpperCase())
      .nullable()
      .default(null),
    valueType: discountValueTypeSchema,
    valueAmount: nullableMoneySchema.default(null),
    currency: nullableCurrencySchema.default(null),
    eligibility: discountEligibilitySchema.default("all_customers"),
    minimumRequirement: discountMinimumRequirementSchema.default("none"),
    minimumPurchaseAmount: nullableMoneySchema.default(null),
    minimumQuantity: nullableQuantitySchema.default(null),
    usageLimit: z
      .number()
      .int()
      .positive()
      .max(2_147_483_647)
      .nullable()
      .default(null),
    oncePerCustomer: z.boolean().default(false),
    combinesWithItemDiscounts: z.boolean().default(false),
    combinesWithOrderDiscounts: z.boolean().default(false),
    combinesWithShippingDiscounts: z.boolean().default(false),
    startsAt: isoTimestampSchema,
    endsAt: isoTimestampSchema.nullable().default(null),
    allBranches: z.boolean().default(true),
    branchIds: branchIdsSchema.default([]),
    channels: channelsSchema.default({
      posEnabled: true,
      customerMobileEnabled: false,
      deliveryEnabled: false,
    }),
    buyRequirementType: discountPurchaseRequirementSchema
      .nullable()
      .default(null),
    buyRequirementValue: nullableQuantitySchema.default(null),
    getQuantity: nullableQuantitySchema.default(null),
    maxUsesPerOrder: z.number().int().positive().nullable().default(null),
    countryScope: discountCountryScopeSchema.default("all"),
    countryCodes: countryCodesSchema.default([]),
    maximumShippingPrice: nullableMoneySchema.default(null),
    tags: tagsSchema.default([]),
    targets: targetsSchema.default([]),
    customerIds: customerIdsSchema.default([]),
  })
  .strict();

function validateDiscountConfiguration(
  value: z.infer<typeof discountBodyShapeSchema>,
  context: z.RefinementCtx,
) {
  if (value.method === "code" && !value.code) {
    context.addIssue({
      code: "custom",
      message: "A discount code is required for code discounts.",
      path: ["code"],
    });
  }
  if (value.method === "automatic" && value.code !== null) {
    context.addIssue({
      code: "custom",
      message: "Automatic discounts cannot have a discount code.",
      path: ["code"],
    });
  }

  if (value.endsAt && Date.parse(value.endsAt) <= Date.parse(value.startsAt)) {
    context.addIssue({
      code: "custom",
      message: "endsAt must be later than startsAt.",
      path: ["endsAt"],
    });
  }

  const currencyRequired =
    value.valueType === "fixed_amount" ||
    value.minimumRequirement === "minimum_amount" ||
    value.buyRequirementType === "minimum_amount" ||
    value.maximumShippingPrice !== null;
  if (currencyRequired !== (value.currency !== null)) {
    context.addIssue({
      code: "custom",
      message:
        "currency is required exactly when an amount-based rule is configured.",
      path: ["currency"],
    });
  }

  if (
    value.valueType === "percentage" &&
    value.valueAmount !== null &&
    Number(value.valueAmount) > 100
  ) {
    context.addIssue({
      code: "custom",
      message: "Percentage discounts cannot exceed 100.",
      path: ["valueAmount"],
    });
  }

  if (value.minimumRequirement === "none") {
    if (
      value.minimumPurchaseAmount !== null ||
      value.minimumQuantity !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "A discount without a minimum cannot contain minimum values.",
        path: ["minimumRequirement"],
      });
    }
  } else if (value.minimumRequirement === "minimum_amount") {
    if (
      value.minimumPurchaseAmount === null ||
      value.minimumQuantity !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "minimum_amount requires only minimumPurchaseAmount.",
        path: ["minimumPurchaseAmount"],
      });
    }
  } else if (
    value.minimumQuantity === null ||
    value.minimumPurchaseAmount !== null
  ) {
    context.addIssue({
      code: "custom",
      message: "minimum_quantity requires only minimumQuantity.",
      path: ["minimumQuantity"],
    });
  }

  if (value.allBranches === value.branchIds.length > 0) {
    context.addIssue({
      code: "custom",
      message:
        "allBranches discounts cannot list branches, and scoped discounts require at least one branch.",
      path: ["branchIds"],
    });
  }

  if (value.eligibility === "all_customers" && value.customerIds.length > 0) {
    context.addIssue({
      code: "custom",
      message: "All-customer discounts cannot list specific customers.",
      path: ["customerIds"],
    });
  }
  if (
    value.eligibility === "specific_customers" &&
    value.customerIds.length === 0
  ) {
    context.addIssue({
      code: "custom",
      message: "Specific-customer discounts require at least one customer.",
      path: ["customerIds"],
    });
  }

  const appliesTo = value.targets.filter(
    (target) => target.role === "applies_to",
  );
  const customerBuys = value.targets.filter(
    (target) => target.role === "customer_buys",
  );
  const customerGets = value.targets.filter(
    (target) => target.role === "customer_gets",
  );

  if (value.type === "amount_off_items") {
    if (
      !["percentage", "fixed_amount"].includes(value.valueType) ||
      value.valueAmount === null ||
      appliesTo.length === 0 ||
      customerBuys.length > 0 ||
      customerGets.length > 0
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Item discounts require an amount and may only use applies-to targets.",
        path: ["targets"],
      });
    }
  } else if (value.type === "amount_off_order") {
    if (
      !["percentage", "fixed_amount"].includes(value.valueType) ||
      value.valueAmount === null ||
      value.targets.length > 0
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Order discounts require an amount and cannot contain item targets.",
        path: ["targets"],
      });
    }
  } else if (value.type === "buy_x_get_y") {
    if (
      value.buyRequirementType === null ||
      value.buyRequirementValue === null ||
      value.getQuantity === null ||
      customerBuys.length === 0 ||
      customerGets.length === 0 ||
      appliesTo.length > 0 ||
      !["percentage", "fixed_amount", "free"].includes(value.valueType) ||
      (value.valueType === "free"
        ? value.valueAmount !== null
        : value.valueAmount === null)
    ) {
      context.addIssue({
        code: "custom",
        message: "Buy-X-get-Y configuration is incomplete.",
        path: ["buyRequirementType"],
      });
    }
  } else if (
    value.valueType !== "free" ||
    value.valueAmount !== null ||
    value.targets.length > 0
  ) {
    context.addIssue({
      code: "custom",
      message:
        "Free-shipping discounts must use the free value and no item targets.",
      path: ["valueType"],
    });
  }

  if (value.type !== "buy_x_get_y") {
    if (
      value.buyRequirementType !== null ||
      value.buyRequirementValue !== null ||
      value.getQuantity !== null ||
      value.maxUsesPerOrder !== null
    ) {
      context.addIssue({
        code: "custom",
        message: "Buy-X-get-Y fields are only valid for that discount type.",
        path: ["buyRequirementType"],
      });
    }
  }

  if (value.type === "free_shipping") {
    if (value.countryScope === "selected" && value.countryCodes.length === 0) {
      context.addIssue({
        code: "custom",
        message: "Selected country scope requires at least one country.",
        path: ["countryCodes"],
      });
    }
    if (value.countryScope === "all" && value.countryCodes.length > 0) {
      context.addIssue({
        code: "custom",
        message: "All-country shipping discounts cannot list countries.",
        path: ["countryCodes"],
      });
    }
  } else if (
    value.countryScope !== "all" ||
    value.countryCodes.length > 0 ||
    value.maximumShippingPrice !== null
  ) {
    context.addIssue({
      code: "custom",
      message: "Shipping fields are only valid for free-shipping discounts.",
      path: ["countryScope"],
    });
  }
}

export const createDiscountBodySchema = discountBodyShapeSchema.superRefine(
  validateDiscountConfiguration,
);

const partialDiscountBodySchema = z
  .object({
    title: discountBodyShapeSchema.shape.title.optional(),
    method: discountBodyShapeSchema.shape.method.optional(),
    enabled: discountBodyShapeSchema.shape.enabled.removeDefault().optional(),
    code: discountBodyShapeSchema.shape.code.removeDefault().optional(),
    valueType: discountBodyShapeSchema.shape.valueType.optional(),
    valueAmount: discountBodyShapeSchema.shape.valueAmount
      .removeDefault()
      .optional(),
    currency: discountBodyShapeSchema.shape.currency.removeDefault().optional(),
    eligibility: discountBodyShapeSchema.shape.eligibility
      .removeDefault()
      .optional(),
    minimumRequirement: discountBodyShapeSchema.shape.minimumRequirement
      .removeDefault()
      .optional(),
    minimumPurchaseAmount: discountBodyShapeSchema.shape.minimumPurchaseAmount
      .removeDefault()
      .optional(),
    minimumQuantity: discountBodyShapeSchema.shape.minimumQuantity
      .removeDefault()
      .optional(),
    usageLimit: discountBodyShapeSchema.shape.usageLimit
      .removeDefault()
      .optional(),
    oncePerCustomer: discountBodyShapeSchema.shape.oncePerCustomer
      .removeDefault()
      .optional(),
    combinesWithItemDiscounts:
      discountBodyShapeSchema.shape.combinesWithItemDiscounts
        .removeDefault()
        .optional(),
    combinesWithOrderDiscounts:
      discountBodyShapeSchema.shape.combinesWithOrderDiscounts
        .removeDefault()
        .optional(),
    combinesWithShippingDiscounts:
      discountBodyShapeSchema.shape.combinesWithShippingDiscounts
        .removeDefault()
        .optional(),
    startsAt: discountBodyShapeSchema.shape.startsAt.optional(),
    endsAt: discountBodyShapeSchema.shape.endsAt.removeDefault().optional(),
    allBranches: discountBodyShapeSchema.shape.allBranches
      .removeDefault()
      .optional(),
    branchIds: discountBodyShapeSchema.shape.branchIds
      .removeDefault()
      .optional(),
    channels: discountBodyShapeSchema.shape.channels.removeDefault().optional(),
    buyRequirementType: discountBodyShapeSchema.shape.buyRequirementType
      .removeDefault()
      .optional(),
    buyRequirementValue: discountBodyShapeSchema.shape.buyRequirementValue
      .removeDefault()
      .optional(),
    getQuantity: discountBodyShapeSchema.shape.getQuantity
      .removeDefault()
      .optional(),
    maxUsesPerOrder: discountBodyShapeSchema.shape.maxUsesPerOrder
      .removeDefault()
      .optional(),
    countryScope: discountBodyShapeSchema.shape.countryScope
      .removeDefault()
      .optional(),
    countryCodes: discountBodyShapeSchema.shape.countryCodes
      .removeDefault()
      .optional(),
    maximumShippingPrice: discountBodyShapeSchema.shape.maximumShippingPrice
      .removeDefault()
      .optional(),
    tags: discountBodyShapeSchema.shape.tags.removeDefault().optional(),
    targets: discountBodyShapeSchema.shape.targets.removeDefault().optional(),
    customerIds: discountBodyShapeSchema.shape.customerIds
      .removeDefault()
      .optional(),
    version: z.number().int().positive(),
  })
  .strict();

export const updateDiscountBodySchema = z.preprocess((value) => {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !Object.keys(value).some((key) => key !== "version")
  ) {
    return { ...value, __emptyDiscountUpdate: true };
  }

  return value;
}, partialDiscountBodySchema);

export const discountListQuerySchema = z.object({
  status: discountDerivedStatusSchema.optional(),
  method: discountMethodSchema.optional(),
  type: discountTypeSchema.optional(),
  branchId: ulidSchema.optional(),
  q: z.string().trim().min(1).max(200).optional(),
  sort: discountListSortSchema.default("created_desc"),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

export const discountParamsSchema = z.object({
  discountId: ulidSchema,
});

export const updateDiscountStatusBodySchema = z
  .object({
    enabled: z.boolean(),
    version: z.number().int().positive(),
  })
  .strict();

export const deleteDiscountBodySchema = z
  .object({
    version: z.number().int().positive(),
  })
  .strict();
