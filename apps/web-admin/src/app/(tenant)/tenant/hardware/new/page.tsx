import { redirect } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";

export default function LegacyNewHardwarePage() {
  redirect(webAdminRoutes.tenant.pointOfSale.newHardware);
}
