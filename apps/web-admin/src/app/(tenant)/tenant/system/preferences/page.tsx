import { redirect } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";

export default function TenantSystemPreferencesPage() {
  redirect(webAdminRoutes.tenant.system.settings);
}
