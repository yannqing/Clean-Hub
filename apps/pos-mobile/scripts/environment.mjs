import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { parse } from "dotenv";
import { paths } from "./runtime-assets.mjs";

const require = createRequire(import.meta.url);
const { resolvePosRuntimeConfig } = require("./runtime-config.cjs");
const POS_ENV_KEYS = [
  "CLEANHUB_POS_RUNTIME",
  "CLEANHUB_POS_SERVER_URL",
  "CLEANHUB_POS_ALLOW_CLEARTEXT",
  "CLEANHUB_POS_VERSION",
  "CLEANHUB_POS_BUILD_NUMBER",
];

function readEnvironmentFile(fileName) {
  const filePath = join(paths.appRoot, fileName);
  if (!existsSync(filePath)) {
    return {};
  }

  return parse(readFileSync(filePath, "utf8"));
}

export function loadPosEnvironment({ production = false } = {}) {
  const fileEnvironment = readEnvironmentFile(
    production ? ".env.production" : ".env",
  );
  const environment = { ...process.env };

  for (const key of POS_ENV_KEYS) {
    if (environment[key] === undefined && fileEnvironment[key] !== undefined) {
      environment[key] = fileEnvironment[key];
    }
  }

  const runtimeConfig = resolvePosRuntimeConfig(environment, {
    requireProduction: production,
  });

  return {
    environment: {
      ...environment,
      CLEANHUB_POS_RUNTIME: runtimeConfig.runtimeMode,
      CLEANHUB_POS_ALLOW_CLEARTEXT: String(runtimeConfig.allowCleartext),
      ...(runtimeConfig.serverUrl
        ? { CLEANHUB_POS_SERVER_URL: runtimeConfig.serverUrl }
        : {}),
    },
    runtimeConfig,
  };
}
