import assert from "node:assert/strict";

import { isT1101NativeRuntime } from "./t1101-bridge";
import { isAutoRecoverablePrintJob } from "./use-print-job-recovery";

assert.equal(
  isT1101NativeRuntime({ isNative: true, platform: "android" }),
  true,
);
assert.equal(
  isT1101NativeRuntime({ isNative: false, platform: "android" }),
  false,
);
assert.equal(
  isT1101NativeRuntime({ isNative: true, platform: "ios" }),
  false,
);

const printJob = {
  id: "01TEST00000000000000000001",
  idempotencyKey: "test",
  payload: {
    documentType: "receipt" as const,
    entityId: "01TEST00000000000000000002",
    title: "Receipt",
    content: "Receipt",
    autoPrint: true,
  },
  status: "pending" as const,
  attempt: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};
assert.equal(isAutoRecoverablePrintJob(printJob), true);
assert.equal(
  isAutoRecoverablePrintJob({ ...printJob, status: "printing" }),
  false,
);
assert.equal(
  isAutoRecoverablePrintJob({
    ...printJob,
    payload: { ...printJob.payload, autoPrint: false },
  }),
  false,
);

console.log("POS-T1101 bridge runtime smoke passed.");
