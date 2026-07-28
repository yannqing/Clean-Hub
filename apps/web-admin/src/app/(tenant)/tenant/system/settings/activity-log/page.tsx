import { TenantAuditLogView } from "@/features/tenant/audit-logs";
import { TenantSettingsSurface } from "@/features/tenant/settings/components";

export default function TenantSettingsActivityLogPage() {
  return (
    <TenantSettingsSurface>
      <TenantAuditLogView embedded />
    </TenantSettingsSurface>
  );
}
