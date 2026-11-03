import { SERVICE_ITEM_TYPES } from "@cleanhub/domain/service-item-catalog";
import { z } from "zod";

const id = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/);
const names = z
  .object({
    en: z.string().trim().min(1).max(80),
    fr: z.string().trim().min(1).max(80),
    "zh-CN": z.string().trim().min(1).max(80),
  })
  .strict();
const descriptions = z
  .object({
    en: z.string().trim().max(1000),
    fr: z.string().trim().max(1000),
    "zh-CN": z.string().trim().max(1000),
  })
  .strict();
export const catalogSelectionSchema = z
  .object({
    itemTypes: z.array(z.enum(SERVICE_ITEM_TYPES)).max(4),
    itemIds: z.array(id).max(800),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      new Set(data.itemTypes).size !== data.itemTypes.length ||
      new Set(data.itemIds).size !== data.itemIds.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate catalog selections are not allowed.",
      });
  });
export const saveCatalogGroupSchema = z
  .object({
    version: z.number().int().positive(),
    names,
    descriptions,
    enabled: z.boolean(),
    sortOrder: z.number().int().min(0).max(1000),
    items: z
      .array(
        z
          .object({
            id: id.optional(),
            names,
            descriptions,
            enabled: z.boolean(),
            sortOrder: z.number().int().min(0).max(1000),
          })
          .strict(),
      )
      .max(200),
  })
  .strict()
  .superRefine((data, ctx) => {
    const ids = data.items.flatMap((item) => (item.id ? [item.id] : []));
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Duplicate article IDs are not allowed.",
      });
    for (const locale of ["en", "fr", "zh-CN"] as const) {
      const values = data.items
        .filter((item) => item.enabled)
        .map((item) => item.names[locale].toLocaleLowerCase());
      if (new Set(values).size !== values.length)
        ctx.addIssue({
          code: "custom",
          path: ["items"],
          message: `Active article names must be unique (${locale}).`,
        });
    }
  });
export const saveCatalogSelectionSchema = z
  .object({
    version: z.number().int().positive(),
    selection: catalogSelectionSchema,
  })
  .strict();
