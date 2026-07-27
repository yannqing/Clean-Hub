import { PointOfSaleSectionLayout } from "@/features/tenant/point-of-sale";

export default function PointOfSaleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PointOfSaleSectionLayout>{children}</PointOfSaleSectionLayout>;
}
