import { TenantDashboardShell } from "@/components/app-shell";

export default function TenantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <TenantDashboardShell>{children}</TenantDashboardShell>;
}
