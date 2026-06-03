import { TenantUserListView } from "@/features/tenant/users";
import { getTenantUserListQuery } from "@/features/tenant/users/queries";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

const PAGE_SIZE = 20;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Team members failed to load.";
}

export default async function TenantUsersPage() {
  const result = await getTenantUserListQuery(
    {
      limit: PAGE_SIZE,
      offset: 0,
    },
    await getTenantServerApiRequestOptions(),
  )
    .then((users) => ({ users, error: undefined }))
    .catch((error: unknown) => ({
      users: [],
      error: getErrorMessage(error),
    }));

  return (
    <TenantUserListView
      initialError={result.error}
      initialUsers={result.users}
    />
  );
}
