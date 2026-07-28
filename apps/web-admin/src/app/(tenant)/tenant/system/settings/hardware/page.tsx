import { HardwareListView } from "@/features/tenant/hardware";
import { TenantSettingsSurface } from "@/features/tenant/settings/components";

export default function TenantSettingsHardwarePage() {
  return (
    <TenantSettingsSurface>
      <HardwareListView embedded />
    </TenantSettingsSurface>
  );
}
