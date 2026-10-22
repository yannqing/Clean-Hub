import {
  PointOfSaleDevicesView,
  getPointOfSaleDevicesQuery,
  type PointOfSaleDeviceConnectivity,
  type PointOfSaleDeviceQuery,
  type PointOfSaleDeviceStatus,
} from "@/features/tenant/point-of-sale";

const PAGE_SIZE = 10;

type PointOfSaleDevicesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getStringParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function getOffset(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function getStatus(
  value: string | undefined,
): PointOfSaleDeviceStatus | undefined {
  return value === "active" || value === "inactive" ? value : undefined;
}

function getConnectivity(
  value: string | undefined,
): PointOfSaleDeviceConnectivity | undefined {
  return value === "online" || value === "offline" || value === "never"
    ? value
    : undefined;
}

export default async function PointOfSaleDevicesPage({
  searchParams,
}: PointOfSaleDevicesPageProps) {
  const params = (await searchParams) ?? {};
  const query: PointOfSaleDeviceQuery = {
    q: getStringParam(params, "q"),
    branchId: getStringParam(params, "branchId"),
    status: getStatus(getStringParam(params, "status")),
    connectivity: getConnectivity(getStringParam(params, "connectivity")),
    limit: PAGE_SIZE,
    offset: getOffset(getStringParam(params, "offset")),
  };
  const result = await getPointOfSaleDevicesQuery(query)
    .then((data) => ({ data, error: undefined as string | undefined }))
    .catch((error: unknown) => ({
      data: undefined,
      error:
        error instanceof Error
          ? error.message
          : "Point-of-sale devices failed to load.",
    }));

  return (
    <PointOfSaleDevicesView
      error={result.error}
      query={query}
      result={result.data}
    />
  );
}
