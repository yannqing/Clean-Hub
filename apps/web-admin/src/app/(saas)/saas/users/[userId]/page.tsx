import { isApiHttpError } from "@cleanhub/api-client";
import { isUlid } from "@cleanhub/id";
import { notFound } from "next/navigation";

import { getCurrentAuthQuery } from "@/features/auth/queries";
import { SaasUserDetailView } from "@/features/saas/users/components";
import { getUserDirectoryDetailQuery } from "@/features/saas/users/queries";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";
import { canManageSaasUsers } from "@/lib/permissions";

type SaasUserDetailPageProps = {
  params: Promise<{ userId: string }>;
};

export default async function SaasUserDetailPage({
  params,
}: SaasUserDetailPageProps) {
  const { userId } = await params;

  if (!isUlid(userId)) {
    notFound();
  }

  let user: Awaited<ReturnType<typeof getUserDirectoryDetailQuery>> | undefined;
  let authContext: Awaited<ReturnType<typeof getCurrentAuthQuery>> | undefined;

  try {
    const requestOptions = await getSaasServerApiRequestOptions();
    [user, authContext] = await Promise.all([
      getUserDirectoryDetailQuery(userId, requestOptions),
      getCurrentAuthQuery(requestOptions),
    ]);
  } catch (error) {
    if (
      isApiHttpError(error) &&
      (error.status === 403 || error.status === 404)
    ) {
      notFound();
    }

    throw error;
  }

  if (!user || !authContext) {
    notFound();
  }

  return (
    <SaasUserDetailView
      key={user.id}
      canManage={canManageSaasUsers(authContext)}
      initialUser={user}
      isCurrentUser={authContext.userId === user.id}
    />
  );
}
