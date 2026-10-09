import type { TenantFeatureFlags, TenantFeatureFlagsFormValues } from "./types";

export function toFeatureFlagsFormValues(
  featureFlags: TenantFeatureFlags,
): TenantFeatureFlagsFormValues {
  return {
    laundryEnabled: featureFlags.laundryEnabled,
    carWashEnabled: featureFlags.carWashEnabled,
    retailProductsEnabled: featureFlags.retailProductsEnabled,
    deliveryEnabled: featureFlags.deliveryEnabled,
    notificationsEnabled: featureFlags.notificationsEnabled,
    emailEnabled: featureFlags.emailEnabled,
    customerOtpEnabled: featureFlags.customerOtpEnabled,
  };
}
