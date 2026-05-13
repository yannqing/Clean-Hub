import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { ulidPrimaryKey } from "./id.js";

export const tenants = pgTable("tenants", {
  id: ulidPrimaryKey(),
  name: text("name").notNull(),
  pressingCode: text("pressing_code").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
