import { AdminDashboardShell } from "@/components/app-shell";

export default function SaasLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminDashboardShell scope="saas">{children}</AdminDashboardShell>;
}
