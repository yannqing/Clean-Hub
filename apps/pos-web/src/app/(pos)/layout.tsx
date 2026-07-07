import { PosShell, type PosShellProfile } from "@/components/app-shell";
import { getNotificationsOverviewQuery } from "@/features/notifications/queries";
import { getCurrentUser } from "@/lib/auth";

export default async function PosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, notificationsOverview] = await Promise.all([
    getCurrentUser(),
    getNotificationsOverviewQuery().catch(() => null),
  ]);

  const profile: PosShellProfile | undefined = user
    ? (() => {
        return {
          name: user.displayName,
          role: user.role,
          initials: user.displayName.charAt(0).toUpperCase(),
        };
      })()
    : undefined;

  return (
    <PosShell
      notificationUnreadCount={notificationsOverview?.unreadCount ?? 0}
      profile={profile}
    >
      {children}
    </PosShell>
  );
}
