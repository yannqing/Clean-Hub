import { redirect } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";

export default function TenantPricesPage() {
  redirect(webAdminRoutes.tenant.services);
}
