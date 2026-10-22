import { getSecuritySettingsQuery } from "@/features/saas/security/queries";
import { webAdminApi } from "@/lib/api-client";

import type { InviteSaasUserFormInput } from "../validators";
import { validateInviteSaasUserForm } from "../validators";

export async function inviteSaasUserAction(input: InviteSaasUserFormInput) {
  const passwordPolicy = await getSecuritySettingsQuery();
  const validation = validateInviteSaasUserForm(input, passwordPolicy);

  if (!validation.ok) {
    return validation;
  }

  const user = await webAdminApi.saas.users.createSaasUser(validation.data);

  return {
    ok: true as const,
    data: user,
  };
}
