import assert from "node:assert/strict";

import { terminalHeartbeatBodySchema } from "../../pos/terminal-settings/terminal-settings.validation.js";
import {
  posChannelDeviceListQuerySchema,
  posChannelOverviewQuerySchema,
  posChannelRegisterSessionQuerySchema,
  removePosChannelDeviceBodySchema,
  updatePosChannelDeviceBodySchema,
  updatePosChannelSettingsBodySchema,
} from "./pos-channel.validation.js";

const overview = posChannelOverviewQuerySchema.parse({
  from: "2025-01-01",
  to: "2026-01-01",
  currency: "xof",
});
assert.equal(overview.currency, "XOF");

assert.throws(() =>
  posChannelOverviewQuerySchema.parse({
    from: "2025-01-01",
    to: "2026-01-02",
  }),
);
assert.throws(() =>
  posChannelOverviewQuerySchema.parse({
    from: "2026-01-01",
  }),
);

assert.deepEqual(posChannelDeviceListQuerySchema.parse({}), {
  limit: 10,
  offset: 0,
});
assert.deepEqual(posChannelRegisterSessionQuerySchema.parse({}), {
  limit: 10,
  offset: 0,
});

assert.deepEqual(
  updatePosChannelDeviceBodySchema.parse({
    label: " Front register ",
    reason: "Move to the front counter",
    version: 2,
  }),
  {
    label: "Front register",
    reason: "Move to the front counter",
    version: 2,
  },
);
assert.throws(() =>
  updatePosChannelDeviceBodySchema.parse({
    reason: "No changed field",
    version: 2,
  }),
);
assert.equal(
  removePosChannelDeviceBodySchema.parse({
    reason: "Terminal retired",
    version: 2,
  }).version,
  2,
);

const settings = updatePosChannelSettingsBodySchema.parse({
  deviceOfflineAfterSeconds: 900,
  version: 3,
});
assert.equal(settings.deviceOfflineAfterSeconds, 900);
assert.throws(() =>
  updatePosChannelSettingsBodySchema.parse({
    version: 3,
  }),
);

const heartbeat = terminalHeartbeatBodySchema.parse({
  appVersion: "1.4.0",
  deviceType: "desktop",
  lastSyncedAt: "2026-07-26T12:00:00.000Z",
  platform: "macOS",
  platformVersion: "15.5",
  syncStatus: "synced",
});
assert.equal(heartbeat.deviceType, "desktop");
assert.throws(() =>
  terminalHeartbeatBodySchema.parse({
    deviceId: "untrusted-device-id",
  }),
);

console.log("POS channel validation smoke passed.");
