import {
  index,
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
import { deliveryTasks } from "./delivery-tasks.js";

export const deliveryProofTypeEnum = pgEnum("delivery_proof_type", [
  "pickup",
  "dropoff",
  "signature",
]);

export const deliveryProofs = pgTable(
  "delivery_proofs",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    taskId: ulidColumn("task_id")
      .notNull()
      .references(() => deliveryTasks.id, { onDelete: "cascade" }),
    type: deliveryProofTypeEnum("type").notNull(),
    mediaRef: text("media_ref").notNull(),
    deviceId: varchar("device_id", { length: 120 }),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("delivery_proofs_task_id_idempotency_key_unique").on(
      table.taskId,
      table.idempotencyKey,
    ),
    index("delivery_proofs_tenant_id_idx").on(table.tenantId),
    index("delivery_proofs_task_id_type_idx").on(table.taskId, table.type),
    index("delivery_proofs_created_at_idx").on(table.createdAt),
  ],
);
