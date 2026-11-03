import type { CatalogTranslations } from "@cleanhub/domain/service-item-catalog";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";

export const platformServiceItemGroups = pgTable(
  "platform_service_item_groups",
  {
    id: ulidPrimaryKey(),
    itemType: varchar("item_type", { length: 16 })
      .$type<"cloth" | "shoe" | "carpet" | "car">()
      .notNull(),
    names: jsonb("names").$type<CatalogTranslations>().notNull(),
    descriptions: jsonb("descriptions").$type<CatalogTranslations>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    version: integer("version").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by"),
  },
  (table) => [
    uniqueIndex("platform_service_item_groups_type_unique").on(table.itemType),
    check(
      "platform_service_item_groups_type_check",
      sql`${table.itemType} in ('cloth','shoe','carpet','car')`,
    ),
    check(
      "platform_service_item_groups_sort_check",
      sql`${table.sortOrder} >= 0`,
    ),
  ],
);

export const platformServiceArticles = pgTable(
  "platform_service_articles",
  {
    id: ulidPrimaryKey(),
    groupId: ulidColumn("group_id")
      .notNull()
      .references(() => platformServiceItemGroups.id, { onDelete: "restrict" }),
    names: jsonb("names").$type<CatalogTranslations>().notNull(),
    descriptions: jsonb("descriptions").$type<CatalogTranslations>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("platform_service_articles_group_idx").on(
      table.groupId,
      table.sortOrder,
    ),
    check("platform_service_articles_sort_check", sql`${table.sortOrder} >= 0`),
  ],
);
