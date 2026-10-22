import {
  PointOfSaleSectionLayout,
  TenantPosRealtimeProvider,
} from "@/features/tenant/point-of-sale";

export default function PointOfSaleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <TenantPosRealtimeProvider>
      <PointOfSaleSectionLayout>{children}</PointOfSaleSectionLayout>
    </TenantPosRealtimeProvider>
  );
}
