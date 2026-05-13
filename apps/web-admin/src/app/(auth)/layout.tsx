import { AdminShell } from "@/components/app-shell";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AdminShell scope="auth">{children}</AdminShell>;
}
