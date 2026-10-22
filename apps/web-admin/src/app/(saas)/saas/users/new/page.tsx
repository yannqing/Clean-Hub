import { getCurrentAuthQuery } from "@/features/auth/queries";
import { SaasUserCreateView } from "@/features/saas/users/components";
import { getSaasRoleListQuery } from "@/features/saas/users/queries";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";
import { canManageSaasUsers } from "@/lib/permissions";

export default async function NewSaasUserPage() {
  const requestOptions = await getSaasServerApiRequestOptions();
  const [authContext, rolesResult] = await Promise.all([
    getCurrentAuthQuery(requestOptions),
    getSaasRoleListQuery(requestOptions)
      .then((roles) => ({ roles, failed: false }))
      .catch(() => ({ roles: [], failed: true })),
  ]);

  return (
    <SaasUserCreateView
      canManage={canManageSaasUsers(authContext)}
      roleLoadFailed={rolesResult.failed}
      roles={rolesResult.roles}
    />
  );
}
