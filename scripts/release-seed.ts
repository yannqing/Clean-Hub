import { join } from "node:path";

import { runDemoSeeds } from "../packages/db/src/seeds/runner.js";

// Local onboarding and release initialization deliberately share one runner.
// It rejects production unless the documented disposable-demo override is set.
const seedsFolder = process.env.CLEANHUB_SEEDS_FOLDER ?? "./db/seeds";
await runDemoSeeds(seedsFolder, join(seedsFolder, "demo-tax-templates.json"));
