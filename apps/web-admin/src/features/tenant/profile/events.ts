export const TENANT_PROFILE_UPDATED_EVENT =
  "cleanhub:tenant-profile-updated";

export type TenantProfileUpdatedEventDetail = {
  displayName: string;
};

export function dispatchTenantProfileUpdated(
  detail: TenantProfileUpdatedEventDetail,
): void {
  window.dispatchEvent(
    new CustomEvent<TenantProfileUpdatedEventDetail>(
      TENANT_PROFILE_UPDATED_EVENT,
      { detail },
    ),
  );
}

