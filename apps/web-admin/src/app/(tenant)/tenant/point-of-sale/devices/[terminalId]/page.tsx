import { notFound } from "next/navigation";

import {
  PointOfSaleDeviceFormView,
  getPointOfSaleDeviceQuery,
} from "@/features/tenant/point-of-sale";
import { getTenantServerApiRequestOptions } from "@/features/tenant/server/api-request-options";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

type EditPointOfSaleDevicePageProps = {
  params: Promise<{ terminalId: string }>;
};

export default async function EditPointOfSaleDevicePage({
  params,
}: EditPointOfSaleDevicePageProps) {
  const { terminalId } = await params;
  if (!ULID_PATTERN.test(terminalId)) notFound();

  const detail = await getPointOfSaleDeviceQuery(
    terminalId,
    await getTenantServerApiRequestOptions(),
  );
  if (!detail) notFound();

  return <PointOfSaleDeviceFormView {...detail} />;
}
