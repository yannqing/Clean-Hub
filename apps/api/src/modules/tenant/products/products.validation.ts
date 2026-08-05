import { z } from "zod";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;

const isoTimestampSchema = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => !Number.isNaN(Date.parse(value)),
    "Invalid ISO timestamp.",
  );

export const tenantProductStatusSchema = z.enum(["active", "inactive"]);

function optionalTrimmedStringSchema(maxLength: number) {
  return z.string().trim().min(1).max(maxLength).optional();
}

function decimalStringSchema(input: {
  integerDigits: number;
  scale: number;
  positive?: boolean;
  signed?: boolean;
}) {
  const pattern = new RegExp(
    `^${input.signed ? "-?" : ""}(?:0|[1-9]\\d{0,${input.integerDigits - 1}})(?:\\.\\d{1,${input.scale}})?$`,
  );

  return z
    .string()
    .trim()
    .regex(pattern, "Invalid decimal value.")
    .refine(
      (value) => !input.positive || Number(value) > 0,
      "Value must be greater than zero.",
    );
}

const productQuantitySchema = decimalStringSchema({
  integerDigits: 11,
  scale: 3,
});
const signedProductQuantitySchema = decimalStringSchema({
  integerDigits: 11,
  scale: 3,
  signed: true,
});
const positiveProductQuantitySchema = decimalStringSchema({
  integerDigits: 11,
  scale: 3,
  positive: true,
});
const productMoneySchema = decimalStringSchema({
  integerDigits: 10,
  scale: 2,
});

const tenantProductTagsSchema = z
  .array(z.string().trim())
  .transform((values) => {
    const normalized: string[] = [];
    const seen = new Set<string>();

    for (const value of values) {
      if (!value) {
        continue;
      }

      const key = value.toLowerCase();

      if (!seen.has(key)) {
        seen.add(key);
        normalized.push(value);
      }
    }

    return normalized;
  })
  .pipe(z.array(z.string().max(60)).max(20));

const tenantProductBranchSettingsSchema = z
  .array(
    z
      .object({
        branchId: z.string().regex(ULID_PATTERN),
        openingStock: productQuantitySchema,
        reorderPoint: productQuantitySchema,
      })
      .strict(),
  )
  .min(1)
  .superRefine((branchSettings, context) => {
    const seen = new Set<string>();

    branchSettings.forEach((setting, index) => {
      if (seen.has(setting.branchId)) {
        context.addIssue({
          code: "custom",
          message: "Branch settings must have unique branch IDs.",
          path: [index, "branchId"],
        });
      }

      seen.add(setting.branchId);
    });
  });

const tenantProductMediaObjectKeysSchema = z
  .array(z.string().trim().min(1).max(1_024))
  .max(10)
  .superRefine((objectKeys, context) => {
    const seen = new Set<string>();

    objectKeys.forEach((objectKey, index) => {
      if (seen.has(objectKey)) {
        context.addIssue({
          code: "custom",
          message: "Media object keys must be unique.",
          path: [index],
        });
      }

      seen.add(objectKey);
    });
  });

const tenantProductRetainedMediaIdsSchema = z
  .array(z.string().regex(ULID_PATTERN))
  .max(10)
  .superRefine((mediaIds, context) => {
    const seen = new Set<string>();

    mediaIds.forEach((mediaId, index) => {
      if (seen.has(mediaId)) {
        context.addIssue({
          code: "custom",
          message: "Retained media IDs must be unique.",
          path: [index],
        });
      }

      seen.add(mediaId);
    });
  });

const tenantProductCategoryAttributeSchema = z.union([
  z
    .object({
      definitionId: z.string().regex(ULID_PATTERN),
      optionIds: z
        .array(z.string().regex(ULID_PATTERN))
        .min(1)
        .max(50)
        .superRefine((optionIds, context) => {
          const seen = new Set<string>();

          optionIds.forEach((optionId, index) => {
            if (seen.has(optionId)) {
              context.addIssue({
                code: "custom",
                message: "Attribute option IDs must be unique.",
                path: [index],
              });
            }

            seen.add(optionId);
          });
        }),
    })
    .strict(),
  z
    .object({
      definitionId: z.string().regex(ULID_PATTERN),
      textValue: z.string().trim().min(1).max(1_000),
    })
    .strict(),
]);

const tenantProductCategoryAttributesSchema = z
  .array(tenantProductCategoryAttributeSchema)
  .max(30)
  .superRefine((attributes, context) => {
    const seen = new Set<string>();

    attributes.forEach((attribute, index) => {
      if (seen.has(attribute.definitionId)) {
        context.addIssue({
          code: "custom",
          message: "Category attribute definitions must be unique.",
          path: [index, "definitionId"],
        });
      }

      seen.add(attribute.definitionId);
    });
  });

export const createTenantProductBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    categoryId: z.string().regex(ULID_PATTERN).optional(),
    categoryName: optionalTrimmedStringSchema(120),
    categoryAttributes: tenantProductCategoryAttributesSchema.default([]),
    brand: optionalTrimmedStringSchema(120),
    description: optionalTrimmedStringSchema(5_000),
    tags: tenantProductTagsSchema,
    status: tenantProductStatusSchema,
    skuCode: z.string().trim().min(1).max(80),
    barcode: optionalTrimmedStringSchema(80),
    variantName: optionalTrimmedStringSchema(160),
    unitOfMeasure: z.string().trim().min(1).max(32),
    unitsPerSale: positiveProductQuantitySchema,
    salePrice: productMoneySchema,
    currency: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(CURRENCY_PATTERN)),
    referenceCost: productMoneySchema.nullable().optional(),
    trackInventory: z.boolean(),
    allowNegativeStock: z.boolean(),
    allowOfflineSale: z.boolean(),
    branchSettings: tenantProductBranchSettingsSchema,
    mediaObjectKeys: tenantProductMediaObjectKeysSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.categoryId && value.categoryName) {
      context.addIssue({
        code: "custom",
        message: "Provide either categoryId or categoryName, not both.",
        path: ["categoryId"],
      });
    }

    if (!value.categoryId && value.categoryAttributes.length > 0) {
      context.addIssue({
        code: "custom",
        message:
          "Category attributes can only be submitted with an existing category ID.",
        path: ["categoryAttributes"],
      });
    }

    if (value.trackInventory) {
      return;
    }

    if (value.allowNegativeStock) {
      context.addIssue({
        code: "custom",
        message:
          "Negative stock cannot be enabled when inventory tracking is disabled.",
        path: ["allowNegativeStock"],
      });
    }

    value.branchSettings.forEach((setting, index) => {
      if (Number(setting.openingStock) !== 0) {
        context.addIssue({
          code: "custom",
          message:
            "Opening stock must be zero when inventory tracking is disabled.",
          path: ["branchSettings", index, "openingStock"],
        });
      }

      if (Number(setting.reorderPoint) !== 0) {
        context.addIssue({
          code: "custom",
          message:
            "Reorder point must be zero when inventory tracking is disabled.",
          path: ["branchSettings", index, "reorderPoint"],
        });
      }
    });
  });

const updateTenantProductBranchSettingsSchema = z
  .array(
    z
      .object({
        branchId: z.string().regex(ULID_PATTERN),
        expectedStockOnHand: signedProductQuantitySchema,
        stockOnHand: signedProductQuantitySchema,
        reorderPoint: productQuantitySchema,
      })
      .strict(),
  )
  .min(1)
  .superRefine((branchSettings, context) => {
    const seen = new Set<string>();

    branchSettings.forEach((setting, index) => {
      if (seen.has(setting.branchId)) {
        context.addIssue({
          code: "custom",
          message: "Branch settings must have unique branch IDs.",
          path: [index, "branchId"],
        });
      }

      seen.add(setting.branchId);
    });
  });

export const updateTenantProductBodySchema = z
  .object({
    version: z.number().int().positive(),
    skuId: z.string().regex(ULID_PATTERN),
    skuVersion: z.number().int().positive(),
    name: z.string().trim().min(1).max(200),
    categoryId: z.string().regex(ULID_PATTERN).optional(),
    categoryName: optionalTrimmedStringSchema(120),
    categoryAttributes: tenantProductCategoryAttributesSchema.default([]),
    brand: optionalTrimmedStringSchema(120),
    description: optionalTrimmedStringSchema(5_000),
    tags: tenantProductTagsSchema,
    status: tenantProductStatusSchema,
    skuCode: z.string().trim().min(1).max(80),
    barcode: optionalTrimmedStringSchema(80),
    variantName: optionalTrimmedStringSchema(160),
    unitOfMeasure: z.string().trim().min(1).max(32),
    unitsPerSale: positiveProductQuantitySchema,
    salePrice: productMoneySchema,
    currency: z
      .string()
      .trim()
      .transform((value) => value.toUpperCase())
      .pipe(z.string().regex(CURRENCY_PATTERN)),
    referenceCost: productMoneySchema.nullable().optional(),
    trackInventory: z.boolean(),
    allowNegativeStock: z.boolean(),
    allowOfflineSale: z.boolean(),
    branchSettings: updateTenantProductBranchSettingsSchema,
    retainedMediaIds: tenantProductRetainedMediaIdsSchema,
    newMediaObjectKeys: tenantProductMediaObjectKeysSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.categoryId && value.categoryName) {
      context.addIssue({
        code: "custom",
        message: "Provide either categoryId or categoryName, not both.",
        path: ["categoryId"],
      });
    }

    if (!value.categoryId && value.categoryAttributes.length > 0) {
      context.addIssue({
        code: "custom",
        message:
          "Category attributes can only be submitted with an existing category ID.",
        path: ["categoryAttributes"],
      });
    }

    if (value.retainedMediaIds.length + value.newMediaObjectKeys.length > 10) {
      context.addIssue({
        code: "custom",
        message: "A product can have at most 10 images.",
        path: ["newMediaObjectKeys"],
      });
    }

    if (value.trackInventory) {
      return;
    }

    if (value.allowNegativeStock) {
      context.addIssue({
        code: "custom",
        message:
          "Negative stock cannot be enabled when inventory tracking is disabled.",
        path: ["allowNegativeStock"],
      });
    }

    value.branchSettings.forEach((setting, index) => {
      if (Number(setting.stockOnHand) !== 0) {
        context.addIssue({
          code: "custom",
          message:
            "Stock on hand must be zero when inventory tracking is disabled.",
          path: ["branchSettings", index, "stockOnHand"],
        });
      }

      if (Number(setting.reorderPoint) !== 0) {
        context.addIssue({
          code: "custom",
          message:
            "Reorder point must be zero when inventory tracking is disabled.",
          path: ["branchSettings", index, "reorderPoint"],
        });
      }
    });
  });

export const tenantProductParamsSchema = z
  .object({
    productId: z.string().regex(ULID_PATTERN),
  })
  .strict();

export const requestTenantProductMediaDownloadsBodySchema = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.string().regex(ULID_PATTERN),
            mediaId: z.string().regex(ULID_PATTERN),
          })
          .strict(),
      )
      .min(1)
      .max(10),
  })
  .strict()
  .superRefine((value, context) => {
    const seen = new Set<string>();

    value.items.forEach((item, index) => {
      const key = `${item.productId}:${item.mediaId}`;

      if (seen.has(key)) {
        context.addIssue({
          code: "custom",
          message: "Product media download items must be unique.",
          path: ["items", index],
        });
      }

      seen.add(key);
    });
  });

export const tenantProductCategoryParamsSchema = z
  .object({
    categoryId: z.string().regex(ULID_PATTERN),
  })
  .strict();

export const requestTenantProductMediaUploadBodySchema = z
  .object({
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    sizeBytes: z
      .number()
      .int()
      .positive()
      .max(5 * 1_024 * 1_024),
  })
  .strict();

export const tenantProductListQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    status: tenantProductStatusSchema.optional(),
    createdAfter: isoTimestampSchema.optional(),
    createdBefore: isoTimestampSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(
    (value) =>
      !value.createdAfter ||
      !value.createdBefore ||
      new Date(value.createdAfter).getTime() <
        new Date(value.createdBefore).getTime(),
    {
      message: "createdAfter must be before createdBefore.",
      path: ["createdAfter"],
    },
  );

export const tenantProductOverviewQuerySchema = z
  .object({
    createdAfter: isoTimestampSchema.optional(),
    createdBefore: isoTimestampSchema.optional(),
  })
  .refine(
    (value) =>
      !value.createdAfter ||
      !value.createdBefore ||
      new Date(value.createdAfter).getTime() <
        new Date(value.createdBefore).getTime(),
    {
      message: "createdAfter must be before createdBefore.",
      path: ["createdAfter"],
    },
  );
