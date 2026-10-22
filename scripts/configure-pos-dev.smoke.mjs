import assert from "node:assert/strict";

import {
  buildCorsOrigins,
  readEnvValue,
  resolveLanHost,
  updateEnvContent,
} from "./configure-pos-dev.mjs";

const original = [
  "# existing values",
  'NEXT_PUBLIC_API_BASE_URL="http://192.168.2.224:4000"',
  'UNCHANGED_SECRET="keep-me"',
  'POS_ALLOWED_DEV_ORIGINS="192.168.2.224"',
  "",
].join("\n");
const updated = updateEnvContent(original, {
  POS_DEV_PROFILE: "local",
  NEXT_PUBLIC_API_BASE_URL: "http://localhost:4000",
  POS_ALLOWED_DEV_ORIGINS: null,
});

assert.equal(readEnvValue(updated, "POS_DEV_PROFILE"), "local");
assert.equal(
  readEnvValue(updated, "NEXT_PUBLIC_API_BASE_URL"),
  "http://localhost:4000",
);
assert.equal(readEnvValue(updated, "POS_ALLOWED_DEV_ORIGINS"), undefined);
assert.equal(readEnvValue(updated, "UNCHANGED_SECRET"), "keep-me");

assert.equal(
  buildCorsOrigins(
    "http://localhost:3000,http://localhost:3001,http://192.168.2.224:3001,https://custom.example",
    "192.168.2.224",
    "192.168.2.106",
  ),
  "http://localhost:3000,http://localhost:3001,http://localhost:3002,https://custom.example,http://192.168.2.106:3001",
);

assert.equal(
  resolveLanHost(undefined, {
    utun4: [
      {
        address: "10.0.0.2",
        family: "IPv4",
        internal: false,
        netmask: "255.255.255.0",
        cidr: "10.0.0.2/24",
        mac: "00:00:00:00:00:00",
      },
    ],
    en0: [
      {
        address: "192.168.2.106",
        family: "IPv4",
        internal: false,
        netmask: "255.255.255.0",
        cidr: "192.168.2.106/24",
        mac: "00:00:00:00:00:00",
      },
    ],
  }),
  "192.168.2.106",
);
assert.equal(resolveLanHost("192.168.50.8", {}), "192.168.50.8");
assert.throws(() => resolveLanHost("8.8.8.8", {}), /private IPv4/);

console.log("POS development profile configuration smoke passed.");
