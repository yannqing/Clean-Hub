import { redirect } from "next/navigation";

import { webAdminRoutes } from "@/config/routes";

type EditHardwarePageProps = {
  params: Promise<{
    hardwareId: string;
  }>;
};

export default async function LegacyEditHardwarePage({
  params,
}: EditHardwarePageProps) {
  const { hardwareId } = await params;
  redirect(webAdminRoutes.tenant.pointOfSale.hardwareDevice(hardwareId));
}
