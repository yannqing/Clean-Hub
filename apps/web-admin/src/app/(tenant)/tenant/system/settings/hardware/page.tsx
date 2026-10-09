import { redirect } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";

export default function LegacyTenantSettingsHardwarePage() {
  redirect(webAdminRoutes.tenant.pointOfSale.hardware);
}
