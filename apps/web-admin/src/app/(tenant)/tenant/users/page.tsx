import { getCurrentAuthQuery } from "@/features/auth/queries/get-current-auth.query";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";
import { TenantUserListView } from "@/features/tenant/users";
import {
  getTenantBranchListQuery,
  getTenantUserListQuery,
} from "@/features/tenant/users/queries";

const PAGE_SIZE = 10;

type TenantUsersPageProps = {
  searchParams?: Promise<{ q?: string | string[] }>;
};

export default async function TenantUsersPage({
  searchParams,
}: TenantUsersPageProps) {
  const queryParam = (await searchParams)?.q;
  const initialSearchQuery = Array.isArray(queryParam)
    ? (queryParam[0] ?? "")
    : (queryParam ?? "");
  const options = await getTenantServerApiRequestOptions();
  const authContext = await getCurrentAuthQuery(options);
  const [usersResult, branchesResult] = await Promise.allSettled([
    getTenantUserListQuery(
      {
        q: initialSearchQuery || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      },
      options,
    ),
    getTenantBranchListQuery(options),
  ]);

  const initialError =
    usersResult.status === "rejected"
      ? usersResult.reason instanceof Error
        ? usersResult.reason.message
        : "Team members failed to load."
      : branchesResult.status === "rejected"
        ? branchesResult.reason instanceof Error
          ? branchesResult.reason.message
          : "Branches failed to load."
        : undefined;

  return (
    <TenantUserListView
      currentRole={authContext.role === "manager" ? "manager" : "owner"}
      currentUserId={authContext.userId}
      initialBranches={
        branchesResult.status === "fulfilled" ? branchesResult.value : []
      }
      initialError={initialError}
      initialSearchQuery={initialSearchQuery}
      initialUsers={usersResult.status === "fulfilled" ? usersResult.value : []}
    />
  );
}
