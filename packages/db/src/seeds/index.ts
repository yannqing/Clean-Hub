import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

import { runDemoSeeds } from "./runner.js";

const seedsDir = dirname(fileURLToPath(import.meta.url));
config({ path: join(seedsDir, "../../../../.env") });

runDemoSeeds(seedsDir, join(seedsDir, "../../../../docs/06-delivery/rollout/cleanhub-phase1-country-tax-templates.json"))
  .catch((error: unknown) => {
    console.error("Database seeding failed.");
    console.error(error);
    process.exitCode = 1;
  });
