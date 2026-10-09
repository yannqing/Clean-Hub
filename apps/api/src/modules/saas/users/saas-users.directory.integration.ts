import assert from "node:assert/strict";

import "../../../config/env.js";
import { auditLogs, authRefreshTokens, closeDbConnection, getDb, roles, runWithSystemDatabaseContext, tenants, userProfiles, userRoles, users } from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import { and, eq, inArray } from "drizzle-orm";

import type { AuthContext } from "../../auth/auth.types.js";
import { findSaasUserDirectory } from "./saas-users.repository.js";
import { getSaasUserDetail, listSaasUserDirectory } from "./saas-users.service.js";
import { getSaasUserDirectoryDetail, resetDirectoryUserPassword, resetDirectoryUserPin } from "./user-directory.service.js";
import { hashPassword, hashPin, verifyPassword } from "../../auth/password.service.js";
import { resetSaasUserPasswordBodySchema } from "./saas-users.validation.js";

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

          const ownerDetail = await getSaasUserDirectoryDetail(
            { authContext: auth, userId: ownerId },
            tx,
          );
          assert.equal(ownerDetail.accountType, "tenant");
          assert.equal(ownerDetail.tenantId, tenantId);
          assert.equal(ownerDetail.tenantCode, prefix);
          assert.deepEqual(ownerDetail.roles, ["owner"]);
          assert.ok(
            !("passwordHash" in ownerDetail) && !("pinHash" in ownerDetail),
            "details never expose credentials",
          );
          const supportAuth: AuthContext = {
            ...auth,
            role: "support",
            roles: ["support"],
          };
          assert.equal(
            (
              await getSaasUserDirectoryDetail(
                { authContext: supportAuth, userId: managerId },
                tx,
              )
            ).status,
            "disabled",
          );
          for (const hiddenId of [
            cashierId,
            revokedId,
            mismatchedId,
            createId(),
          ]) {
            await assert.rejects(
              getSaasUserDirectoryDetail(
                { authContext: auth, userId: hiddenId },
                tx,
              ),
              "detail eligibility matches the directory",
            );
          }

          const platformTargetId = await addUser("platform target", null, 1);
          const originalPassword = "Previous!Password9";
          const originalPin = "111222";
          const passwordHash = await hashPassword(originalPassword);
          const pinHash = await hashPin(originalPin);
          await tx
            .update(users)
            .set({ passwordHash, pinHash })
            .where(inArray(users.id, [ownerId, platformTargetId, cashierId]));
          const createSession = async (
            userId: string,
            scopedTenantId: string | null,
          ) => {
            const id = createId();
            await tx
              .insert(authRefreshTokens)
              .values({
                id,
                userId,
                tenantId: scopedTenantId,
                tokenHash: createId(),
                familyId: createId(),
                expiresAt: new Date(Date.now() + 60_000),
              });
            return id;
          };
          const otherSessionId = await createSession(cashierId, tenantId);
          const otherTenantUserId = await addUser(
            "other credential",
            otherTenantId,
            1,
          );
          const otherTenantSessionId = await createSession(
            otherTenantUserId,
            otherTenantId,
          );
          const otherHashBefore = (
            await tx
              .select({
                passwordHash: users.passwordHash,
                pinHash: users.pinHash,
              })
              .from(users)
              .where(eq(users.id, otherTenantUserId))
          )[0];

          for (const targetId of [ownerId, platformTargetId]) {
            const scopedTenantId = targetId === ownerId ? tenantId : null;
            const passwordSessionId = await createSession(
              targetId,
              scopedTenantId,
            );
            const resetInput = {
              authContext: auth,
              userId: targetId,
              reason: "Integration credential recovery",
            };
            const passwordResult = await resetDirectoryUserPassword(
              resetInput,
              tx,
            );
            const [passwordRecord] = await tx
              .select({
                passwordHash: users.passwordHash,
                pinHash: users.pinHash,
              })
              .from(users)
              .where(eq(users.id, targetId));
            assert.ok(passwordRecord);
            assert.ok(
              await verifyPassword(
                passwordResult.temporaryPassword,
                passwordRecord.passwordHash,
              ),
              "new password authenticates",
            );
            assert.equal(
              await verifyPassword(
                originalPassword,
                passwordRecord.passwordHash,
              ),
              false,
              "old password no longer authenticates",
            );
            assert.equal(
              passwordRecord.pinHash,
              pinHash,
              "password reset preserves PIN",
            );
            assert.ok(
              (
                await tx
                  .select()
                  .from(authRefreshTokens)
                  .where(eq(authRefreshTokens.id, passwordSessionId))
              )[0]?.revokedAt,
            );

            const pinSessionId = await createSession(targetId, scopedTenantId);
            const pinResult = await resetDirectoryUserPin(resetInput, tx);
            assert.match(pinResult.temporaryPin, /^\d{6}$/);
            const [pinRecord] = await tx
              .select({
                passwordHash: users.passwordHash,
                pinHash: users.pinHash,
              })
              .from(users)
              .where(eq(users.id, targetId));
            assert.ok(pinRecord);
            assert.ok(
              await verifyPassword(pinResult.temporaryPin, pinRecord.pinHash),
              "new PIN authenticates",
            );
            assert.equal(
              await verifyPassword(originalPin, pinRecord.pinHash),
              false,
              "old PIN no longer authenticates",
            );
            assert.equal(
              pinRecord.passwordHash,
              passwordRecord.passwordHash,
              "PIN reset preserves password",
            );
            assert.ok(
              (
                await tx
                  .select()
                  .from(authRefreshTokens)
                  .where(eq(authRefreshTokens.id, pinSessionId))
              )[0]?.revokedAt,
            );
            assert.equal(
              await verifyPassword(pinResult.temporaryPin, pinHash),
              false,
              "generated PIN differs from another employee's PIN",
            );

            const audits = await tx
              .select()
              .from(auditLogs)
              .where(
                and(
                  eq(auditLogs.entityId, targetId),
                  eq(auditLogs.reason, resetInput.reason),
                ),
              );
            assert.equal(audits.length, 2);
            assert.deepEqual(
              new Set(audits.map((row) => row.eventType)),
              new Set(
                scopedTenantId
                  ? ["tenant_user.password_reset", "tenant_user.pin_reset"]
                  : ["saas_user.password_reset", "saas_user.pin_reset"],
              ),
            );
            for (const audit of audits) {
              assert.equal(audit.tenantId, scopedTenantId);
              assert.equal(audit.actorUserId, platformId);
              assert.deepEqual(audit.metadata, {
                accountType: scopedTenantId ? "tenant" : "saas",
                initiatedFrom: "platform_user_directory",
              });
              assert.equal(audit.before, null);
              assert.equal(audit.after, null);
            }
          }
          for (const reset of [
            resetDirectoryUserPassword,
            resetDirectoryUserPin,
          ]) {
            const request = {
              authContext: auth,
              userId: ownerId,
              reason: "Blocked request",
            };
            await assert.rejects(
              reset({ ...request, authContext: supportAuth }, tx),
              "support cannot reset credentials",
            );
            await assert.rejects(
              reset({ ...request, authContext: { ...auth, tenantId } }, tx),
              "tenant-scoped actors cannot reset from the platform",
            );
            await assert.rejects(
              reset({ ...request, userId: platformId }, tx),
              "self-service uses the profile flow",
            );
            await assert.rejects(
              reset({ ...request, reason: " " }, tx),
              "blank reasons are rejected at service level",
            );
            await assert.rejects(
              reset({ ...request, reason: "x".repeat(501) }, tx),
              "oversized reasons are rejected",
            );
            for (const hiddenId of [
              cashierId,
              revokedId,
              mismatchedId,
              createId(),
            ]) {
              await assert.rejects(
                reset({ ...request, userId: hiddenId }, tx),
                "credential reset has the same directory scope",
              );
            }
          }
          assert.equal(
            resetSaasUserPasswordBodySchema.safeParse({ reason: " " }).success,
            false,
          );
          assert.equal(
            resetSaasUserPasswordBodySchema.safeParse({
              reason: "x".repeat(501),
            }).success,
            false,
          );
          for (const sessionId of [otherSessionId, otherTenantSessionId]) {
            assert.equal(
              (
                await tx
                  .select()
                  .from(authRefreshTokens)
                  .where(eq(authRefreshTokens.id, sessionId))
              )[0]?.revokedAt,
              null,
              "other accounts' sessions stay valid",
            );
          }
          const [otherHashAfter] = await tx
            .select({
              passwordHash: users.passwordHash,
              pinHash: users.pinHash,
            })
            .from(users)
            .where(eq(users.id, otherTenantUserId));
          assert.deepEqual(
            otherHashAfter,
            otherHashBefore,
            "another tenant's credentials remain unchanged",
          );

          await tx
            .update(tenants)
            .set({ deletedAt: new Date() })
            .where(eq(tenants.id, tenantId));
          assert.equal(
            (await findSaasUserDirectory(tx, query)).total,
            2,
            "deleted tenants disappear from the directory",
          );
          await assert.rejects(
            getSaasUserDirectoryDetail(
              { authContext: auth, userId: ownerId },
              tx,
            ),
            "deleted tenants cannot enter user details",
          );
          await assert.rejects(
            resetDirectoryUserPassword(
              { authContext: auth, userId: ownerId, reason: "Deleted target" },
              tx,
            ),
          );
          await assert.rejects(
            resetDirectoryUserPin(
              { authContext: auth, userId: ownerId, reason: "Deleted target" },
              tx,
            ),
          );
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
