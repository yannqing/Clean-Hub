/** CI/local fixture only. Never create or change a production bucket. */
import assert from "node:assert/strict";
import { CreateBucketCommand } from "@aws-sdk/client-s3";
import { createS3Client, loadStorageConfig } from "./index.js";

const config = loadStorageConfig();
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(config.endpoint).hostname), "Use a loopback test storage endpoint.");
const client = createS3Client(config);
try {
  await client.send(new CreateBucketCommand({ Bucket: config.bucket }));
} catch (error) {
  if ((error as { name?: string }).name !== "BucketAlreadyOwnedByYou") throw error;
} finally {
  client.destroy();
}
console.log("Local private media fixture prepared.");
