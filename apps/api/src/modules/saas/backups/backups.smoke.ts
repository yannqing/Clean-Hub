import assert from "node:assert/strict";

import "../../../config/env.js";

import { eq } from "drizzle-orm";
import {
  backupJobs,
  closeDbConnection,
  getDb,
  restoreRequests,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import type { AuthContext } from "../../auth/auth.types.js";
import {
  createBackupJob,
  createRestoreRequest,
  reviewRestoreRequest,
} from "./backups.service.js";

const ROLLBACK = new Error("BACKUPS_SMOKE_ROLLBACK");

async function run(): Promise<void> {
  const db = getDb();
  try {
    await db.transaction(async (tx) => {
      const actorId = createId();
      const backupId = createId();
      await tx.insert(users).values({
        id: actorId,
        userType: "saas",
        status: "active",
        passwordHash: "not-used",
        pinHash: "not-used",
      });
      await tx.insert(backupJobs).values({
        id: backupId,
        scope: "platform",
        status: "succeeded",
        requestedBy: actorId,
        startedAt: new Date(),
        finishedAt: new Date(),
        resultMetadata: { physicalScope: "platform", checksum: "test" },
      });
      const auth: AuthContext = {
        userId: actorId,
        displayName: "SaaS backup smoke",
        tenantId: null,
        branchIds: [],
        role: "super_admin",
        roles: ["super_admin"],
        permissions: [],
        accessTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      await assert.rejects(
        () =>
          createBackupJob(
            auth,
            { scope: "tenant", tenantId: createId() },
            {},
            tx,
          ),
        (error: unknown) =>
          (error as { code?: string }).code === "BACKUP_TENANT_NOT_FOUND",
      );
      const request = await createRestoreRequest(
        auth,
        backupId,
        { reason: "Verify manual recovery review" },
        tx,
      );
      assert.equal(request.status, "pending");
      const approved = await reviewRestoreRequest(
        auth,
        request.id,
        "approve",
        "Approved for manual restore",
        {},
        tx,
      );
      assert.equal(approved.status, "approved");
      await assert.rejects(
        () =>
          reviewRestoreRequest(auth, request.id, "approve", undefined, {}, tx),
        (error: unknown) =>
          (error as { code?: string }).code === "RESTORE_TRANSITION_CONFLICT",
      );
      await assert.rejects(
        () =>
          reviewRestoreRequest(auth, request.id, "complete", undefined, {}, tx),
        (error: unknown) =>
          (error as { code?: string }).code ===
          "RESTORE_COMPLETION_NOTE_REQUIRED",
      );
      const completed = await reviewRestoreRequest(
        auth,
        request.id,
        "complete",
        "Operator verified the isolated restore",
        {},
        tx,
      );
      assert.equal(completed.status, "completed");
      const [stored] = await tx
        .select({
          status: restoreRequests.status,
          note: restoreRequests.reviewNote,
        })
        .from(restoreRequests)
        .where(eq(restoreRequests.id, request.id));
      assert.equal(stored?.status, "completed");
      assert.equal(stored?.note, "Operator verified the isolated restore");
      throw ROLLBACK;
    });
  } catch (error) {
    if (error !== ROLLBACK) throw error;
  } finally {
    await closeDbConnection();
  }
}

run().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
