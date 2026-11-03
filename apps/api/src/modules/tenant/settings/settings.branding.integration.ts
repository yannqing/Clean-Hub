import assert from "node:assert/strict";
import "../../../config/env.js";
import { eq } from "drizzle-orm";
import {
  auditLogs,
  branches,
  closeDbConnection,
  getDb,
  mediaObjects,
  runWithSystemDatabaseContext,
  tenantFeatureFlags,
  tenantSettings,
  tenants,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import { ObjectStorage, loadStorageConfig } from "@cleanhub/storage";
import type { AuthContext } from "../../auth/auth.types.js";
import { getMyPosBranch } from "../../pos/branches/pos.service.js";
import {
  getTenantSettings,
  requestTenantPosLogoUpload,
  updateTenantSettings,
} from "./settings.service.js";
import {
  tenantPosLogoUploadBodySchema,
  updateTenantSettingsBodySchema,
} from "./settings.validation.js";

const rollback = new Error("BRANDING_TEST_ROLLBACK");
const storage = new ObjectStorage(loadStorageConfig());
const uploaded: string[] = [];
async function run() {
  for (const endpoint of [
    process.env.DATABASE_URL!,
    process.env.OBJECT_STORAGE_ENDPOINT!,
  ]) {
    assert.ok(
      ["localhost", "127.0.0.1", "postgres", "minio", "[::1]"].includes(
        new URL(endpoint).hostname,
      ),
      "Use local database and storage only.",
    );
  }
  try {
    await runWithSystemDatabaseContext(async () => {
      try {
        await getDb().transaction(async (tx) => {
          const tenantId = createId(),
            userId = createId(),
            branchId = createId(),
            otherTenantId = createId();
          await tx.insert(tenants).values([
            {
              id: tenantId,
              name: "Original merchant",
              pressingCode: `BRAND-${tenantId}`,
            },
            {
              id: otherTenantId,
              name: "Other merchant",
              pressingCode: `BRAND-${otherTenantId}`,
            },
          ]);
          await tx
            .insert(users)
            .values({
              id: userId,
              tenantId,
              userType: "tenant",
              passwordHash: "test",
              pinHash: "test",
              status: "active",
            });
          await tx.insert(tenantSettings).values({ id: createId(), tenantId });
          await tx
            .insert(tenantFeatureFlags)
            .values({ id: createId(), tenantId });
          await tx
            .insert(branches)
            .values({
              id: branchId,
              tenantId,
              name: "Branch",
              defaultCurrency: "XOF",
            });
          const auth: AuthContext = {
            tenantId,
            userId,
            role: "owner",
            roles: ["owner"],
            permissions: [],
            branchIds: [branchId],
            terminalBranchId: branchId,
            accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
            displayName: "Owner",
          };
          const save = (data: {
            posDisplayName: string;
            posLogoObjectKey: string | null;
          }) => updateTenantSettings({ authContext: auth, data }, tx);
          assert.equal(
            (await getTenantSettings({ authContext: auth }, tx)).posDisplayName,
            "Original merchant",
          );
          assert.equal(
            updateTenantSettingsBodySchema.safeParse({
              posDisplayName: " ",
              posLogoObjectKey: null,
            }).success,
            false,
          );
          assert.equal(
            updateTenantSettingsBodySchema.safeParse({
              posDisplayName: "Only half",
            }).success,
            false,
          );
          assert.equal(
            tenantPosLogoUploadBodySchema.safeParse({
              contentType: "image/svg+xml",
              sizeBytes: 20,
            }).success,
            false,
          );
          assert.equal(
            tenantPosLogoUploadBodySchema.safeParse({
              contentType: "image/png",
              sizeBytes: 5 * 1024 * 1024 + 1,
            }).success,
            false,
          );
          await assert.rejects(
            save({ posDisplayName: "", posLogoObjectKey: null }),
            { code: "TENANT_POS_BRANDING_REQUIRED" },
          );
          await save({ posDisplayName: "My pressing", posLogoObjectKey: null });
          let branch = await getMyPosBranch({ authContext: auth }, tx);
          assert.equal(branch?.posDisplayName, "My pressing");
          assert.equal(
            branch?.merchantName,
            "Original merchant",
            "Visual branding must not rewrite the receipt/legal merchant name",
          );

          const png = Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aKf8AAAAASUVORK5CYII=",
            "base64",
          );
          const ticket = await requestTenantPosLogoUpload(
            {
              authContext: auth,
              data: { contentType: "image/png", sizeBytes: png.length },
            },
            tx,
          );
          uploaded.push(ticket.objectKey);
          assert.equal(
            (
              await fetch(ticket.uploadUrl, {
                method: "PUT",
                headers: ticket.headers,
                body: png,
              })
            ).ok,
            true,
          );
          const onlyLogo = await save({
            posDisplayName: "",
            posLogoObjectKey: ticket.objectKey,
          });
          assert.equal(onlyLogo.posDisplayName, "");
          assert.ok(onlyLogo.posLogoUrl);
          branch = await getMyPosBranch({ authContext: auth }, tx);
          assert.equal(branch?.posLogoObjectKey, ticket.objectKey);
          assert.equal(branch?.posDisplayName, "");
          const image = await fetch(branch!.posLogoUrl!);
          assert.equal(image.ok, true);
          assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
          const [record] = await tx
            .select()
            .from(mediaObjects)
            .where(eq(mediaObjects.objectKey, ticket.objectKey));
          assert.equal(record?.status, "committed");
          await save({
            posDisplayName: "My pressing",
            posLogoObjectKey: ticket.objectKey,
          });
          // A borrowed tenant key and an arbitrary existing image purpose cannot become branding.
          await assert.rejects(
            save({
              posDisplayName: "Name",
              posLogoObjectKey: `tenants/${otherTenantId}/tenant_pos_logo/logo.png`,
            }),
            { code: "TENANT_POS_LOGO_INVALID" },
          );
          const wrongPurpose = await requestTenantPosLogoUpload(
            {
              authContext: auth,
              data: { contentType: "image/png", sizeBytes: png.length },
            },
            tx,
          );
          await tx
            .update(mediaObjects)
            .set({ purpose: "product_image" })
            .where(eq(mediaObjects.objectKey, wrongPurpose.objectKey));
          await assert.rejects(
            save({
              posDisplayName: "Name",
              posLogoObjectKey: wrongPurpose.objectKey,
            }),
            { code: "TENANT_POS_LOGO_INVALID" },
          );
          await assert.rejects(
            updateTenantSettings(
              {
                authContext: { ...auth, role: "manager", roles: ["manager"] },
                data: { posDisplayName: "Denied", posLogoObjectKey: null },
              },
              tx,
            ),
            { code: "FORBIDDEN" },
          );
          const removed = await save({
            posDisplayName: "My pressing",
            posLogoObjectKey: null,
          });
          assert.equal(removed.posLogoUrl, null);
          assert.equal(
            (await getMyPosBranch({ authContext: auth }, tx))?.posLogoUrl,
            null,
          );
          const audit = await tx
            .select()
            .from(auditLogs)
            .where(eq(auditLogs.tenantId, tenantId));
          assert.ok(
            audit.some(
              (row) =>
                (row.after as Record<string, unknown>)?.posDisplayName ===
                "My pressing",
            ),
          );
          await assert.rejects(
            tx.transaction(async (savepoint) => {
              await savepoint
                .update(tenantSettings)
                .set({ posDisplayName: "", posLogoObjectKey: null })
                .where(eq(tenantSettings.tenantId, tenantId));
            }),
            (error: unknown) =>
              (error as { cause?: { constraint?: string } }).cause
                ?.constraint === "tenant_settings_pos_branding_required",
          );
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    });
    console.log(
      "Tenant POS branding integration passed: inheritance, name/logo/both, real upload and download, tenant isolation, owner permission, removal, audit and database constraint. Rolled back.",
    );
  } finally {
    for (const objectKey of uploaded) await storage.deleteObject(objectKey);
    await closeDbConnection();
  }
}
await run();
