import { isApiHttpError } from "@cleanhub/api-client";

export type ProductAccessState = "enabled" | "disabled" | "unavailable";

export function isProductsFeatureDisabled(error: unknown): boolean {
  return isApiHttpError(error) && error.code === "FEATURE_DISABLED";
}
