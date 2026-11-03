import { redirect } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";
import { getAuthSessionQuery } from "@/features/auth/queries";
import { PlatformSettingsWorkspace } from "@/features/saas/platform-settings/components/platform-settings-workspace";
import { getSaasServerApiRequestOptions } from "@/features/saas/server/api-request-options";

export default async function SaasPlatformSettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const authContext = await getAuthSessionQuery(
    await getSaasServerApiRequestOptions(),
  );
  if (authContext && authContext.role !== "super_admin") {
    redirect(webAdminRoutes.saas.home);
  }

  return <PlatformSettingsWorkspace>{children}</PlatformSettingsWorkspace>;
}
