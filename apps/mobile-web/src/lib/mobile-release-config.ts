export type MobileAppEnvironment = "dev" | "staging" | "prod";

export interface MobileReleaseConfig {
  appEnvironment: MobileAppEnvironment;
  apiBaseUrl: string;
  appVersion: string;
  appBuildNumber: string;
  minSupportedVersion: string;
  updateUrl: string;
}

const DEFAULT_API_BASE_BY_ENV: Record<MobileAppEnvironment, string> = {
  dev: "http://localhost:4000",
  staging: "https://staging-api.cleanhub.local",
  prod: "https://api.cleanhub.local",
};

function normalizeEnvironment(value: string | undefined): MobileAppEnvironment {
  if (value === "staging" || value === "prod") {
    return value;
  }

  return "dev";
}

export const mobileReleaseConfig: MobileReleaseConfig = {
  appEnvironment: normalizeEnvironment(process.env.NEXT_PUBLIC_MOBILE_APP_ENV),
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    DEFAULT_API_BASE_BY_ENV[normalizeEnvironment(process.env.NEXT_PUBLIC_MOBILE_APP_ENV)],
  appVersion: process.env.NEXT_PUBLIC_MOBILE_APP_VERSION ?? "0.1.0",
  appBuildNumber: process.env.NEXT_PUBLIC_MOBILE_BUILD_NUMBER ?? "1",
  minSupportedVersion: process.env.NEXT_PUBLIC_MOBILE_MIN_SUPPORTED_VERSION ?? "0.1.0",
  updateUrl: process.env.NEXT_PUBLIC_MOBILE_UPDATE_URL ?? "https://cleanhub.local/mobile",
};

export function compareSemver(left: string, right: string): number {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

export function isMobileUpdateRequired(config: MobileReleaseConfig = mobileReleaseConfig): boolean {
  return compareSemver(config.appVersion, config.minSupportedVersion) < 0;
}
