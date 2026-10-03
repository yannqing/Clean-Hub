import { redirect } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";

export default function SaasSystemSecurityPage() {
  redirect(webAdminRoutes.saas.auditSecurity);
}
