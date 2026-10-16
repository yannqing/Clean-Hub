import assert from "node:assert/strict";

import {
  StorageValidationError,
  assertTenantObjectKey,
  buildTenantObjectKey,
  getExtensionForContentType,
  loadStorageConfig,
  validateMediaContentType,
  validateMediaFileSize,
} from "./index.js";

const config = loadStorageConfig({
  OBJECT_STORAGE_ENDPOINT: "http://localhost:9000",
  OBJECT_STORAGE_BUCKET: "cleanhub-media",
  OBJECT_STORAGE_ACCESS_KEY: "cleanhub",
  OBJECT_STORAGE_SECRET_KEY: "cleanhub-minio-password",
  OBJECT_STORAGE_ALLOWED_CONTENT_TYPES: "image/jpeg,image/png",
  OBJECT_STORAGE_MAX_FILE_SIZE_BYTES: "1024",
});

assert.equal(config.region, "us-east-1");
assert.equal(config.forcePathStyle, true);
assert.deepEqual(config.allowedContentTypes, ["image/jpeg", "image/png"]);

const objectKey = buildTenantObjectKey({
  tenantId: "TENANT_01",
  purpose: "delivery_proof",
  segments: ["TASK_01"],
  fileName: `PROOF_01.${getExtensionForContentType("image/jpeg")}`,
});

assert.equal(
  objectKey,
  "tenant/TENANT_01/delivery_proof/TASK_01/PROOF_01.jpg",
);
assert.doesNotThrow(() => assertTenantObjectKey(objectKey, "TENANT_01"));
assert.throws(
  () => assertTenantObjectKey(objectKey, "TENANT_02"),
  StorageValidationError,
);

assert.doesNotThrow(() => validateMediaContentType("image/jpeg", config.allowedContentTypes));
assert.throws(
  () => validateMediaContentType("image/gif", config.allowedContentTypes),
  StorageValidationError,
);

assert.doesNotThrow(() => validateMediaFileSize(1024, config.maxFileSizeBytes));
assert.throws(
  () => validateMediaFileSize(1025, config.maxFileSizeBytes),
  StorageValidationError,
);

// A prefix match alone is not enough. Keys reaching this helper do not all
// come from buildTenantObjectKey, and a backend that normalises the path would
// resolve these outside the tenant's prefix.
for (const traversalKey of [
  "tenant/TENANT_01/../TENANT_02/secret.pdf",
  "tenant/TENANT_01/media/../../TENANT_02/secret.pdf",
  "tenant/TENANT_01/..",
  "tenant/TENANT_01/./media/file.pdf",
]) {
  assert.throws(
    () => assertTenantObjectKey(traversalKey, "TENANT_01"),
    StorageValidationError,
    `traversal must be rejected: ${traversalKey}`,
  );
}

// Empty segments would also normalise unpredictably.
for (const malformedKey of [
  "tenant/TENANT_01//media/file.pdf",
  "tenant/TENANT_01/media//file.pdf",
  "tenant/TENANT_01/",
]) {
  assert.throws(
    () => assertTenantObjectKey(malformedKey, "TENANT_01"),
    StorageValidationError,
    `malformed key must be rejected: ${malformedKey}`,
  );
}

// A tenant whose id is a prefix of another must not reach across.
assert.throws(
  () => assertTenantObjectKey("tenant/TENANT_011/file.pdf", "TENANT_01"),
  StorageValidationError,
  "a longer tenant id must not match a shorter one's prefix",
);

// Legitimate keys still pass, including the bare prefix.
assert.doesNotThrow(() =>
  assertTenantObjectKey("tenant/TENANT_01", "TENANT_01"),
);
assert.doesNotThrow(() =>
  assertTenantObjectKey(
    "tenant/TENANT_01/media/2026/photo.jpg",
    "TENANT_01",
  ),
);
// "..." is a legal name, not traversal.
assert.doesNotThrow(() =>
  assertTenantObjectKey("tenant/TENANT_01/media/....jpg", "TENANT_01"),
);

console.log("storage smoke ok");
