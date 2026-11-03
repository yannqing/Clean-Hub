import { webAdminApi } from "@/lib/api-client";

import type { UpdateSaasUserFormInput } from "../validators";
import { validateUpdateSaasUserForm } from "../validators";

export async function updateSaasUserAction(
  userId: string,
  input: UpdateSaasUserFormInput,
) {
  const validation = validateUpdateSaasUserForm(input);

  if (!validation.ok) {
    return validation;
  }

  const user = await webAdminApi.saas.users.update(userId, validation.data);

  return {
    ok: true as const,
    data: user,
  };
}
