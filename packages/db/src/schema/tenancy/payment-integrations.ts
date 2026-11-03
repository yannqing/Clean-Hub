import {
  boolean,
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
import { tenants } from "./tenants.js";

export const paymentIntegrationProviderEnum = pgEnum(
  "payment_integration_provider",
  ["wave", "orange_money"],
);

export const paymentIntegrationVerificationStatusEnum = pgEnum(
  "payment_integration_verification_status",
  ["verified", "invalid"],
);

export const tenantPaymentIntegrations = pgTable(
  "tenant_payment_integrations",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    provider: paymentIntegrationProviderEnum("provider").notNull(),
    encryptedCredentials: text("encrypted_credentials").notNull(),
    encryptionKeyVersion: integer("encryption_key_version")
      .notNull()
      .default(1),
    credentialHint: varchar("credential_hint", { length: 160 }).notNull(),
    verificationStatus: paymentIntegrationVerificationStatusEnum(
      "verification_status",
    )
      .notNull()
      .default("verified"),
    posEnabled: boolean("pos_enabled").notNull().default(false),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    lastVerificationError: text("last_verification_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: ulidColumn("updated_by").references(() => users.id),
    version: integer("version").notNull().default(1),
  },
  (table) => [
    uniqueIndex("tenant_payment_integrations_tenant_provider_unique").on(
      table.tenantId,
      table.provider,
    ),
    index("tenant_payment_integrations_enabled_idx").on(
      table.tenantId,
      table.posEnabled,
      table.verificationStatus,
    ),
    index("tenant_payment_integrations_updated_by_idx").on(table.updatedBy),
  ],
);
