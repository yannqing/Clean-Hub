import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "./id.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

export const authRefreshTokens = pgTable(
  "auth_refresh_tokens",
  {
    id: ulidPrimaryKey(),
    userId: ulidColumn("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    tokenHash: text("token_hash").notNull(),
    familyId: ulidColumn("family_id").notNull(),
    deviceId: varchar("device_id", { length: 120 }),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 64 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    replacedByTokenId: ulidColumn("replaced_by_token_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_refresh_tokens_token_hash_unique").on(table.tokenHash),
    index("auth_refresh_tokens_user_id_idx").on(table.userId),
    index("auth_refresh_tokens_family_id_idx").on(table.familyId),
    index("auth_refresh_tokens_expires_at_idx").on(table.expiresAt),
    index("auth_refresh_tokens_revoked_at_idx").on(table.revokedAt),
  ],
);

export const authLoginLockouts = pgTable(
  "auth_login_lockouts",
  {
    id: ulidPrimaryKey(),
    lockKey: varchar("lock_key", { length: 320 }).notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("auth_login_lockouts_lock_key_unique").on(table.lockKey),
  ],
);
