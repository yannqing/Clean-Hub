import assert from "node:assert/strict";

import { scheduleNonOverlapping } from "./schedule.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A run that outlives its interval must not be joined by the next tick.
// With a bare setInterval both ticks would be in flight at once, which is how
// two purge runs end up acting on the same due set.
let concurrent = 0;
let maxConcurrent = 0;
let completed = 0;
let skipped = 0;

const timer = scheduleNonOverlapping(
  20,
  async () => {
    concurrent += 1;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    await sleep(90);
    concurrent -= 1;
    completed += 1;
  },
  (error: unknown) => {
    throw error;
  },
  () => {
    skipped += 1;
  },
);

await sleep(300);
clearInterval(timer);

assert.equal(maxConcurrent, 1, "runs must never overlap");
assert.ok(completed >= 2, `the job must keep running (completed ${completed})`);
assert.ok(skipped > 0, "ticks arriving mid-run must be skipped, not queued");

// A failing run must release the guard, or the job would wedge permanently
// after its first error.
let attempts = 0;
const errors: unknown[] = [];
const failing = scheduleNonOverlapping(
  20,
  async () => {
    attempts += 1;
    throw new Error("boom");
  },
  (error: unknown) => {
    errors.push(error);
  },
);

await sleep(120);
clearInterval(failing);

assert.ok(attempts >= 2, `a failing run must not wedge the job (${attempts})`);
assert.equal(errors.length, attempts, "every failure is reported once");

console.log("cron scheduler smoke passed.");
