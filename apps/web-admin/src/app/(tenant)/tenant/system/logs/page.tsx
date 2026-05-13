import { PagePlaceholder } from "@/components/app-shell";

export default function TenantSystemLogsPage() {
  return (
    <PagePlaceholder
      description="Tenant operation logs for staff actions, configuration changes, login events, and sensitive activity."
      items={["Login logs", "Staff actions", "Config changes", "Exports"]}
      title="Operation Logs"
    />
  );
}
