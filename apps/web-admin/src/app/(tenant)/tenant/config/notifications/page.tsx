import { PagePlaceholder } from "@/components/app-shell";

export default function TenantNotificationsPage() {
  return (
    <PagePlaceholder
      description="Tenant notification settings for operational messages, customer updates, and channel preferences."
      items={["SMS", "WhatsApp", "Email", "Templates"]}
      title="Notifications"
    />
  );
}
