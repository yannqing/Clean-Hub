import { PosShell, type PosShellProfile } from "@/components/app-shell";
import { PosRuntimeConfigProvider } from "@/components/runtime/pos-runtime-config";
import { getMyBranchQuery } from "@/features/branches/queries";
import { getNotificationsOverviewQuery } from "@/features/notifications/queries";
import { OfflineSyncProvider } from "@/features/offline/components";
import {
  PosTerminalHeartbeatReporter,
  PosTerminalSessionGuard,
} from "@/features/terminal-setup/components";
import { getCurrentUser } from "@/lib/auth";

export default async function PosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, notificationsOverview, branch] = await Promise.all([
    getCurrentUser(),
    getNotificationsOverviewQuery().catch(() => null),
    getMyBranchQuery().catch(() => null),
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
  const runtimeBranchId = user?.terminalBranchId ?? branch?.id ?? null;

  return (
    <PosRuntimeConfigProvider
      tenantId={user?.tenantId}
      branchId={runtimeBranchId}
      terminalId={user?.terminalId}
      userId={user?.userId}
      terminalCredentialVersion={user?.terminalCredentialVersion}
      currency={branch?.defaultCurrency}
    >
      <PosTerminalSessionGuard />
      <OfflineSyncProvider
        tenantId={user?.tenantId}
        branchId={runtimeBranchId}
        terminalId={user?.terminalId}
        userId={user?.userId}
        terminalCredentialVersion={user?.terminalCredentialVersion}
      >
        <PosTerminalHeartbeatReporter enabled={Boolean(user?.terminalId)} />
        <PosShell
          notificationUnreadCount={notificationsOverview?.unreadCount ?? 0}
          profile={profile}
        >
          {children}
        </PosShell>
      </OfflineSyncProvider>
    </PosRuntimeConfigProvider>
  );
}
