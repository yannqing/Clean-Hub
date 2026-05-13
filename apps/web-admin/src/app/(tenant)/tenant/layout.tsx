import { AdminDashboardShell } from "@/components/app-shell";

export default function TenantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminDashboardShell scope="tenant">{children}</AdminDashboardShell>;
}
