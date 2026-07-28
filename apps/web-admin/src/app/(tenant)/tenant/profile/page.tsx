import {
  getTenantProfileQuery,
  TenantProfileView,
} from "@/features/tenant/profile";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

export default async function TenantProfilePage() {
  const requestOptions = await getTenantServerApiRequestOptions();
  const profile = await getTenantProfileQuery(requestOptions).catch(() => null);

  return <TenantProfileView initialProfile={profile} />;
}
