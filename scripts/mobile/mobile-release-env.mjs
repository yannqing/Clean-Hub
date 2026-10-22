const allowedEnvironments = new Set(["dev", "staging", "prod"]);

const defaults = {
  dev: {
    apiBaseUrl: "http://localhost:4000",
    updateUrl: "https://cleanhub.local/mobile/dev",
  },
  staging: {
    apiBaseUrl: "https://staging-api.cleanhub.local",
    updateUrl: "https://staging.cleanhub.local/mobile",
  },
  prod: {
    apiBaseUrl: "https://api.cleanhub.local",
    updateUrl: "https://cleanhub.local/mobile",
  },
};

export function resolveMobileReleaseEnv(rawEnv = process.env) {
  const appEnvironment = rawEnv.CLEANHUB_MOBILE_ENV ?? rawEnv.MOBILE_APP_ENV ?? "dev";

  if (!allowedEnvironments.has(appEnvironment)) {
    throw new Error(
      `Unsupported CLEANHUB_MOBILE_ENV "${appEnvironment}". Expected dev, staging, or prod.`,
    );
  }

  const version = rawEnv.CLEANHUB_MOBILE_VERSION ?? "0.1.0";
  const buildNumber = rawEnv.CLEANHUB_MOBILE_BUILD_NUMBER ?? "1";
  const minSupportedVersion = rawEnv.CLEANHUB_MOBILE_MIN_SUPPORTED_VERSION ?? version;

  return {
    appEnvironment,
    apiBaseUrl: rawEnv.CLEANHUB_MOBILE_API_BASE_URL ?? defaults[appEnvironment].apiBaseUrl,
    version,
    buildNumber,
    minSupportedVersion,
    updateUrl: rawEnv.CLEANHUB_MOBILE_UPDATE_URL ?? defaults[appEnvironment].updateUrl,
  };
}

export function toNextPublicEnv(releaseEnv) {
  return {
    NEXT_PUBLIC_MOBILE_APP_ENV: releaseEnv.appEnvironment,
    NEXT_PUBLIC_API_BASE_URL: releaseEnv.apiBaseUrl,
    NEXT_PUBLIC_MOBILE_APP_VERSION: releaseEnv.version,
    NEXT_PUBLIC_MOBILE_BUILD_NUMBER: releaseEnv.buildNumber,
    NEXT_PUBLIC_MOBILE_MIN_SUPPORTED_VERSION: releaseEnv.minSupportedVersion,
    NEXT_PUBLIC_MOBILE_UPDATE_URL: releaseEnv.updateUrl,
  };
}
