import type {
  ChangeSaasProfilePasswordRequest,
  UpdateSaasProfileRequest,
} from "@cleanhub/api-client";

import { webAdminApi } from "@/lib/api-client";

export const updateSaasProfileAction = (input: UpdateSaasProfileRequest) =>
  webAdminApi.saas.profile.update(input);
export const changeSaasProfilePasswordAction = (
  input: ChangeSaasProfilePasswordRequest,
) => webAdminApi.saas.profile.changePassword(input);
