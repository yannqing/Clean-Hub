import { PosShell, type PosShellProfile } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
  owner: "店主",
  manager: "店长",
  cashier: "收银员",
};

export default async function PosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  const profile: PosShellProfile | undefined = user
    ? (() => {
        const roleLabel = ROLE_LABELS[user.role] ?? user.role;
        return {
          name: user.displayName,
          role: roleLabel,
          initials: user.displayName.charAt(0).toUpperCase(),
        };
      })()
    : undefined;

  return <PosShell profile={profile}>{children}</PosShell>;
}
