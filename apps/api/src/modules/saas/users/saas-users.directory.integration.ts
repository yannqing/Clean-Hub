import assert from "node:assert/strict";

import "../../../config/env.js";
import { closeDbConnection, getDb, roles, runWithSystemDatabaseContext, tenants, userProfiles, userRoles, users } from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import { eq } from "drizzle-orm";

import type { AuthContext } from "../../auth/auth.types.js";
import { findSaasUserDirectory } from "./saas-users.repository.js";
import { getSaasUserDetail, listSaasUserDirectory } from "./saas-users.service.js";

const rollback = new Error("SAAS_USER_DIRECTORY_ROLLBACK");

async function run() {
  try {
    await runWithSystemDatabaseContext(async () => {
      try {
        await getDb().transaction(async (tx) => {
          const prefix = `Directory-${createId()}`;
          const tenantId = createId();
          const otherTenantId = createId();
          await tx.insert(tenants).values([
            { id: tenantId, name: `${prefix} tenant`, pressingCode: prefix },
            { id: otherTenantId, name: `${prefix} other tenant`, pressingCode: `${prefix}-other` },
          ]);
          const addUser = async (suffix: string, accountTenantId: string | null, day: number, status: "active" | "disabled" = "active") => {
            const id = createId();
            await tx.insert(users).values({
              id, tenantId: accountTenantId, userType: accountTenantId ? "tenant" : "saas",
              passwordHash: "integration-only", pinHash: "integration-only", status,
              createdAt: new Date(`2020-01-0${day}T00:00:00Z`),
            });
            await tx.insert(userProfiles).values({ userId: id, tenantId: accountTenantId, displayName: `${prefix} ${suffix}`, language: "en" });
            return id;
          };
          const platformId = await addUser("platform", null, 3);
          const ownerId = await addUser("owner", tenantId, 4);
          const managerId = await addUser("manager", tenantId, 2, "disabled");
          const cashierId = await addUser("cashier", tenantId, 5);
          const revokedId = await addUser("revoked", tenantId, 5);
          const mismatchedId = await addUser("mismatched", tenantId, 5);
          const ownerRoleId = createId();
          const managerRoleId = createId();
          const cashierRoleId = createId();
          const otherOwnerRoleId = createId();
          await tx.insert(roles).values([
            { id: ownerRoleId, tenantId, scope: "tenant", code: "owner", name: "Owner" },
            { id: managerRoleId, tenantId, scope: "tenant", code: "manager", name: "Manager" },
            { id: cashierRoleId, tenantId, scope: "tenant", code: "cashier", name: "Cashier" },
            { id: otherOwnerRoleId, tenantId: otherTenantId, scope: "tenant", code: "owner", name: "Other owner" },
          ]);
          await tx.insert(userRoles).values([
            { id: createId(), userId: ownerId, tenantId, roleId: ownerRoleId },
            { id: createId(), userId: managerId, tenantId, roleId: managerRoleId },
            { id: createId(), userId: managerId, tenantId, roleId: ownerRoleId },
            { id: createId(), userId: cashierId, tenantId, roleId: cashierRoleId },
            { id: createId(), userId: revokedId, tenantId, roleId: ownerRoleId, revokedAt: new Date() },
            { id: createId(), userId: mismatchedId, tenantId, roleId: otherOwnerRoleId },
          ]);
          const query = { q: prefix, limit: 100, offset: 0 };
          const result = await findSaasUserDirectory(tx, query);
          assert.deepEqual(result.items.map((row) => row.id), [ownerId, platformId, managerId], "both account types share one ordering without duplicates");
          assert.equal(result.total, 3);
          assert.equal(result.statusCounts.active, 2);
          assert.equal(result.statusCounts.disabled, 1);
          assert.deepEqual(result.items[2]?.roles, ["manager", "owner"]);

          const first = await findSaasUserDirectory(tx, { ...query, limit: 1 });
          const second = await findSaasUserDirectory(tx, { ...query, limit: 1, offset: 1 });
          assert.equal(first.items[0]?.id, ownerId);
          assert.equal(second.items[0]?.id, platformId, "pagination crosses account types in the same list");
          assert.equal(first.total, 3);
          const platform = await findSaasUserDirectory(tx, { ...query, accountType: "saas" });
          assert.deepEqual(platform.items.map((row) => row.id), [platformId]);
          assert.equal(platform.total, 1);
          const tenant = await findSaasUserDirectory(tx, { ...query, accountType: "tenant", status: "disabled" });
          assert.deepEqual(tenant.items.map((row) => row.id), [managerId]);
          assert.equal(tenant.total, 2);
          assert.equal((await findSaasUserDirectory(tx, { ...query, q: `${prefix} tenant` })).items.length, 2, "tenant names are searchable");

          const auth: AuthContext = {
            userId: platformId, displayName: "Test admin", tenantId: null,
            branchIds: [], role: "super_admin", roles: ["super_admin"], permissions: [],
            accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
          };
          await assert.rejects(listSaasUserDirectory({ authContext: { ...auth, tenantId }, query }, tx), "tenant context cannot query the global directory");
          await assert.rejects(getSaasUserDetail({ authContext: auth, userId: ownerId }, tx), "tenant accounts cannot enter the SaaS member edit path");

          await tx.update(tenants).set({ deletedAt: new Date() }).where(eq(tenants.id, tenantId));
          assert.equal((await findSaasUserDirectory(tx, query)).total, 1, "deleted tenants disappear from the directory");
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    });
  } finally {
    await closeDbConnection();
  }
}

run().then(() => console.log("Unified user directory integration passed with a clean rollback."));
