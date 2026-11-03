import { redirect } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";

export default function LegacyHardwarePage() {
  redirect(webAdminRoutes.tenant.pointOfSale.hardware);
}
