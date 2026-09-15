import { PosShell, type PosShellProfile } from "@/components/app-shell";
import { PosRuntimeConfigProvider } from "@/components/runtime/pos-runtime-config";
import { getMyBranchQuery } from "@/features/branches/queries";
import { getNotificationsOverviewQuery } from "@/features/notifications/queries";
import { OfflineSyncProvider } from "@/features/offline/components";
import { PosTerminalRealtimeProvider } from "@/features/realtime/components";
import { PosHardwareCacheWarmer } from "@/features/hardware/components/pos-hardware-cache-warmer";
import { getTerminalSettingsQuery } from "@/features/settings/queries/get-terminal-settings.query";
import {
  PosIdleLock,
  PosTerminalSessionGuard,
} from "@/features/terminal-setup/components";
import { getCurrentUser } from "@/lib/auth";

export default async function PosLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [user, notificationsOverview, branch, terminalSettings] =
    await Promise.all([
      getCurrentUser(),
      getNotificationsOverviewQuery().catch(() => null),
      getMyBranchQuery().catch(() => null),
      getTerminalSettingsQuery().catch(() => null),
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
      timeZone={user?.timezone}
      role={user?.role}
      defaultPaymentMethod={terminalSettings?.defaultPaymentMethod}
      paymentMethodsEnabled={terminalSettings?.paymentMethodsEnabled}
      mobileMoneyProvidersEnabled={
        terminalSettings?.mobileMoneyProvidersEnabled
      }
      roundingRule={terminalSettings?.roundingRule}
      cashRoundingStep={branch?.cashRoundingStep}
      taxEnabled={terminalSettings?.taxEnabled}
      defaultTaxRate={terminalSettings?.defaultTaxRate}
      pricesIncludeTax={terminalSettings?.pricesIncludeTax}
      taxRegistrationNumber={terminalSettings?.taxRegistrationNumber}
      merchantName={branch?.merchantName}
      branchName={branch?.name}
      receiptName={branch?.receiptName}
      receiptPhone={branch?.receiptPhone || branch?.phone}
      receiptAddress={branch?.receiptAddress || branch?.address}
      receiptThankYouMessage={branch?.receiptThankYouMessage}
      receiptFields={branch?.receiptFields}
      ticketLabelFields={branch?.ticketLabelFields}
      operatorName={user?.displayName}
      terminalName={terminalSettings?.label}
      autoPrintReceipt={terminalSettings?.autoPrintReceipt}
      printCopies={terminalSettings?.printCopies}
    >
      <PosTerminalSessionGuard />
      <PosHardwareCacheWarmer />
      <OfflineSyncProvider
        tenantId={user?.tenantId}
        branchId={runtimeBranchId}
        terminalId={user?.terminalId}
        userId={user?.userId}
        terminalCredentialVersion={user?.terminalCredentialVersion}
      >
        <PosTerminalRealtimeProvider enabled={Boolean(user?.terminalId)}>
          <PosIdleLock
            lockTimeoutSeconds={
              user ? (terminalSettings?.lockTimeoutSeconds ?? null) : null
            }
          />
          <PosShell
            branchName={branch?.name ?? "—"}
            merchantName={branch?.merchantName || "POS"}
            notificationUnreadCount={notificationsOverview?.unreadCount ?? 0}
            profile={profile}
          >
            {children}
          </PosShell>
        </PosTerminalRealtimeProvider>
      </OfflineSyncProvider>
    </PosRuntimeConfigProvider>
  );
}
