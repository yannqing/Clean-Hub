import { redirect } from "next/navigation";

import { isNavFeatureVisible } from "@/config/feature-visibility";
import { webAdminRoutes } from "@/config/routes";
import { BackupJobListView } from "@/features/saas/backups/components";

export default function SaasSystemBackupsPage() {
  if (!isNavFeatureVisible("backups")) {
    redirect(webAdminRoutes.saas.home);
  }

  return <BackupJobListView />;
}
