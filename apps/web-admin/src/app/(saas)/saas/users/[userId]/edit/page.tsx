import { isApiHttpError } from "@cleanhub/api-client";
import { isUlid } from "@cleanhub/id";
import { notFound } from "next/navigation";

import { getCurrentAuthQuery } from "@/features/auth/queries";
import { SaasUserEditView } from "@/features/saas/users/components";
import {
  getSaasRoleListQuery,
  getSaasUserDetailQuery,
} from "@/features/saas/users/queries";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";
import { canManageSaasUsers } from "@/lib/permissions";

type EditSaasUserPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function EditSaasUserPage({
  params,
}: EditSaasUserPageProps) {
  const { userId } = await params;

  if (!isUlid(userId)) {
    notFound();
  }

  const requestOptions = await getSaasServerApiRequestOptions();
  const [user, authContext, rolesResult] = await Promise.all([
    getSaasUserDetailQuery(userId, requestOptions),
    getCurrentAuthQuery(requestOptions),
    getSaasRoleListQuery(requestOptions)
      .then((roles) => ({ failed: false, roles }))
      .catch(() => ({ failed: true, roles: [] })),
  ]).catch((error: unknown) => {
    if (
      isApiHttpError(error) &&
      (error.status === 403 || error.status === 404)
    ) {
      notFound();
    }

    throw error;
  });

  return (
    <SaasUserEditView
      canManage={canManageSaasUsers(authContext)}
      initialUser={user}
      roleLoadFailed={rolesResult.failed}
      roles={rolesResult.roles}
    />
  );
}
