import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "../id.js";
import { users } from "../identity/users.js";
import { tenants } from "../tenancy/tenants.js";
import { deliveryTaskStatusEnum, deliveryTasks } from "./delivery-tasks.js";

export const deliveryTaskEvents = pgTable(
  "delivery_task_events",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id")
      .notNull()
      .references(() => tenants.id),
    taskId: ulidColumn("task_id")
      .notNull()
      .references(() => deliveryTasks.id, { onDelete: "cascade" }),
    fromStatus: deliveryTaskStatusEnum("from_status"),
    toStatus: deliveryTaskStatusEnum("to_status").notNull(),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    deviceId: varchar("device_id", { length: 120 }),
    idempotencyKey: varchar("idempotency_key", { length: 120 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: ulidColumn("created_by").references(() => users.id),
  },
  (table) => [
    uniqueIndex("delivery_task_events_task_id_idempotency_key_unique").on(
      table.taskId,
      table.idempotencyKey,
    ),
    index("delivery_task_events_tenant_id_idx").on(table.tenantId),
    index("delivery_task_events_task_id_created_at_idx").on(
      table.taskId,
      table.createdAt,
    ),
    index("delivery_task_events_to_status_idx").on(table.toStatus),
  ],
);
