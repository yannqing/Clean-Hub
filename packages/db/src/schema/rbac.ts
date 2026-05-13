import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { ulidColumn, ulidPrimaryKey } from "./id.js";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

export const roleScopeEnum = pgEnum("role_scope", ["saas", "tenant", "pos"]);
export const roleStatusEnum = pgEnum("role_status", ["active", "disabled"]);
export const permissionScopeEnum = pgEnum("permission_scope", [
  "saas",
  "tenant",
  "pos",
  "system",
]);

export const roles = pgTable(
  "roles",
  {
    id: ulidPrimaryKey(),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    scope: roleScopeEnum("scope").notNull(),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    status: roleStatusEnum("status").notNull().default("active"),
    isSystem: boolean("is_system").notNull().default(false),
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
    uniqueIndex("roles_tenant_scope_code_unique").on(
      table.tenantId,
      table.scope,
      table.code,
    ),
    index("roles_tenant_id_idx").on(table.tenantId),
    index("roles_scope_idx").on(table.scope),
  ],
);

export const permissions = pgTable(
  "permissions",
  {
    id: ulidPrimaryKey(),
    scope: permissionScopeEnum("scope").notNull(),
    code: varchar("code", { length: 120 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("permissions_code_unique").on(table.code),
    index("permissions_scope_idx").on(table.scope),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: ulidColumn("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: ulidColumn("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.roleId, table.permissionId],
      name: "role_permissions_pk",
    }),
    index("role_permissions_permission_id_idx").on(table.permissionId),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    id: ulidPrimaryKey(),
    userId: ulidColumn("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: ulidColumn("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    tenantId: ulidColumn("tenant_id").references(() => tenants.id),
    branchId: ulidColumn("branch_id"),
    assignedBy: ulidColumn("assigned_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("user_roles_user_role_tenant_branch_unique").on(
      table.userId,
      table.roleId,
      table.tenantId,
      table.branchId,
    ),
    index("user_roles_user_id_idx").on(table.userId),
    index("user_roles_role_id_idx").on(table.roleId),
    index("user_roles_tenant_id_idx").on(table.tenantId),
    index("user_roles_branch_id_idx").on(table.branchId),
  ],
);
