import { webAdminApi } from "@/lib/api-client";

import type { UpdateSaasUserRolesFormInput } from "../validators";
import { validateUpdateSaasUserRolesForm } from "../validators";

export async function updateSaasUserRolesAction(
  userId: string,
  input: UpdateSaasUserRolesFormInput,
) {
  const validation = validateUpdateSaasUserRolesForm(input);

  if (!validation.ok) {
    return validation;
  }

  const user = await webAdminApi.saas.users.updateRoles(
    userId,
    validation.data,
  );

  return {
    ok: true as const,
    data: user,
  };
}
