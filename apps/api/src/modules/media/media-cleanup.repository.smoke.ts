import assert from "node:assert/strict";

import "../../config/env.js";

import { and, eq } from "drizzle-orm";

import { closeDbConnection, getDb, mediaObjects, tenants } from "@cleanhub/db";
import { createId } from "@cleanhub/id";

import { MediaRepository } from "./media.repository.js";

export async function runMediaCleanupRepositorySmokeChecks(): Promise<void> {
  const db = getDb();
  const tenantRows = await db.select({ id: tenants.id }).from(tenants).limit(1);
  const tenantId = tenantRows[0]?.id;

  assert.ok(tenantId, "media cleanup smoke requires at least one tenant");

  const mediaObjectId = createId();
  const objectKey = `tenant/${tenantId}/product_image/unassigned/${mediaObjectId}.jpg`;
  const now = new Date();
  const expiredAt = new Date(now.getTime() - 60 * 60 * 1000);
  const repository = new MediaRepository(db);

  await db.insert(mediaObjects).values({
    id: mediaObjectId,
    tenantId,
    objectKey,
    contentType: "image/jpeg",
    sizeBytes: 128,
    purpose: "product_image",
    expiresAt: expiredAt,
  });

  try {
    const concurrentTokens = [createId(), createId()];
    const concurrentClaims = await Promise.all(
      concurrentTokens.map((claimToken) =>
        repository.claimExpiredPending({
          now,
          staleClaimedBefore: new Date(now.getTime() - 5 * 60 * 1000),
          limit: 1,
          claimToken,
        }),
      ),
    );
    const claimedRows = concurrentClaims.flat();

    assert.equal(
      claimedRows.length,
      1,
      "concurrent cleanup workers must not claim the same media object",
    );

    const firstClaim = claimedRows[0]!;
    assert.equal(firstClaim.status, "deleting");
    assert.equal(
      await repository.completeCleanup({
        id: firstClaim.id,
        tenantId: firstClaim.tenantId,
        objectKey: firstClaim.objectKey,
        claimToken: createId(),
        claimedAt: new Date(firstClaim.cleanupClaimedAt),
      }),
      false,
      "a worker with the wrong claim token must not finalize cleanup",
    );
    assert.equal(
      await repository.releaseCleanup({
        id: firstClaim.id,
        tenantId: firstClaim.tenantId,
        objectKey: firstClaim.objectKey,
        claimToken: firstClaim.cleanupClaimToken,
        claimedAt: new Date(firstClaim.cleanupClaimedAt),
      }),
      true,
    );

    const oldClaimedAt = new Date(now.getTime() - 10 * 60 * 1000);
    const oldClaims = await repository.claimExpiredPending({
      now: oldClaimedAt,
      staleClaimedBefore: new Date(oldClaimedAt.getTime() - 5 * 60 * 1000),
      limit: 1,
      claimToken: createId(),
    });
    const oldClaim = oldClaims[0]!;
    const replacementClaims = await repository.claimExpiredPending({
      now,
      staleClaimedBefore: new Date(now.getTime() - 5 * 60 * 1000),
      limit: 1,
      claimToken: createId(),
    });
    const replacementClaim = replacementClaims[0]!;

    assert.ok(oldClaim, "expired pending media must be claimable");
    assert.ok(replacementClaim, "a stale deleting claim must be reclaimable");
    assert.notEqual(
      oldClaim.cleanupClaimToken,
      replacementClaim.cleanupClaimToken,
    );
    assert.equal(
      await repository.releaseCleanup({
        id: oldClaim.id,
        tenantId: oldClaim.tenantId,
        objectKey: oldClaim.objectKey,
        claimToken: oldClaim.cleanupClaimToken,
        claimedAt: new Date(oldClaim.cleanupClaimedAt),
      }),
      false,
      "a stale worker must not release a replacement worker's claim",
    );
    assert.equal(
      await repository.markCommitted({
        tenantId,
        objectKey,
      }),
      null,
      "deleting media must not be committed",
    );
    assert.equal(
      await repository.releaseCleanup({
        id: replacementClaim.id,
        tenantId: replacementClaim.tenantId,
        objectKey: replacementClaim.objectKey,
        claimToken: replacementClaim.cleanupClaimToken,
        claimedAt: new Date(replacementClaim.cleanupClaimedAt),
      }),
      true,
    );

    const committed = await repository.markCommitted({
      tenantId,
      objectKey,
    });

    assert.equal(committed?.status, "committed");
    assert.deepEqual(
      await repository.claimExpiredPending({
        now,
        staleClaimedBefore: new Date(now.getTime() - 5 * 60 * 1000),
        limit: 1,
        claimToken: createId(),
      }),
      [],
      "committed media must never be reclaimed for cleanup",
    );
  } finally {
    await db
      .delete(mediaObjects)
      .where(
        and(
          eq(mediaObjects.tenantId, tenantId),
          eq(mediaObjects.id, mediaObjectId),
        ),
      );
  }
}

if (process.argv[1]?.endsWith("media-cleanup.repository.smoke.ts")) {
  try {
    await runMediaCleanupRepositorySmokeChecks();
  } finally {
    await closeDbConnection();
  }
}
