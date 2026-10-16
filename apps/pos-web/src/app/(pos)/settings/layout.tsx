import { SettingsWorkspace } from "@/features/settings/components/settings-workspace";

export default function PosSettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <SettingsWorkspace>{children}</SettingsWorkspace>;
}
