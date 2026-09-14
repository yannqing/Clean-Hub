import { redirect } from "next/navigation";

import { SaasPagePlaceholder } from "@/components/app-shell/saas-page-placeholder";
import { isNavFeatureVisible } from "@/config/feature-visibility";
import { webAdminRoutes } from "@/config/routes";

export default function SaasLocalizationPage() {
  // Hidden from the sidebar until the page is real; guard the route too so a
  // direct URL cannot reach placeholder content, matching the backups pages.
  if (!isNavFeatureVisible("saasConfigLocalization")) {
    redirect(webAdminRoutes.saas.home);
  }

  return <SaasPagePlaceholder page="localization" />;
}
