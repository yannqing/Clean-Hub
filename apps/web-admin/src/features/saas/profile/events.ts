export const SAAS_PROFILE_UPDATED_EVENT = "cleanhub:saas-profile-updated";

export type SaasProfileUpdatedEventDetail = {
  displayName: string;
};

export function dispatchSaasProfileUpdated(
  detail: SaasProfileUpdatedEventDetail,
): void {
  window.dispatchEvent(
    new CustomEvent<SaasProfileUpdatedEventDetail>(SAAS_PROFILE_UPDATED_EVENT, {
      detail,
    }),
  );
}
