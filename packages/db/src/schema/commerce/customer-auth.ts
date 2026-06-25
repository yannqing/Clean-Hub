import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { tenants } from "../tenancy/tenants.js";
import { customerAccounts } from "./customer-accounts.js";

export const customerAuthOtpPurposeEnum = pgEnum(
  "customer_auth_otp_purpose",
  ["login", "password_reset"],
);

export const customerCredentials = pgTable(
  "customer_credentials",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    customerAccountId: ulidColumn("customer_account_id")
      .notNull()
      .references(() => customerAccounts.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: ulidColumn("deleted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("customer_credentials_account_unique").on(
      table.customerAccountId,
    ),
    index("customer_credentials_tenant_id_idx").on(table.tenantId),
    index("customer_credentials_deleted_at_idx").on(table.deletedAt),
  ],
);

export const customerAuthOtps = pgTable(
  "customer_auth_otps",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    customerAccountId: ulidColumn("customer_account_id")
      .notNull()
      .references(() => customerAccounts.id, { onDelete: "cascade" }),
    phone: varchar("phone", { length: 32 }).notNull(),
    code: varchar("code", { length: 16 }).notNull(),
    purpose: customerAuthOtpPurposeEnum("purpose").notNull().default("login"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    index("customer_auth_otps_tenant_phone_purpose_idx").on(
      table.tenantId,
      table.phone,
      table.purpose,
    ),
    index("customer_auth_otps_customer_account_id_idx").on(
      table.customerAccountId,
    ),
    index("customer_auth_otps_expires_at_idx").on(table.expiresAt),
    index("customer_auth_otps_consumed_at_idx").on(table.consumedAt),
    index("customer_auth_otps_deleted_at_idx").on(table.deletedAt),
  ],
);

export const customerAuthRefreshTokens = pgTable(
  "customer_auth_refresh_tokens",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    customerAccountId: ulidColumn("customer_account_id")
      .notNull()
      .references(() => customerAccounts.id, { onDelete: "cascade" }),
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
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("customer_auth_refresh_tokens_token_hash_unique").on(
      table.tokenHash,
    ),
    index("customer_auth_refresh_tokens_customer_account_id_idx").on(
      table.customerAccountId,
    ),
    index("customer_auth_refresh_tokens_tenant_id_idx").on(table.tenantId),
    index("customer_auth_refresh_tokens_family_id_idx").on(table.familyId),
    index("customer_auth_refresh_tokens_expires_at_idx").on(table.expiresAt),
    index("customer_auth_refresh_tokens_revoked_at_idx").on(table.revokedAt),
    index("customer_auth_refresh_tokens_deleted_at_idx").on(table.deletedAt),
  ],
);
