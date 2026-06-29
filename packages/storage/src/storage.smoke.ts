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

console.log("storage smoke ok");
