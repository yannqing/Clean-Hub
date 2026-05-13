import { PagePlaceholder } from "@/components/app-shell";

export default function ApiHealthPage() {
  return (
    <PagePlaceholder
      description="Operational placeholder for checking API connectivity and backend service health."
      items={["API status", "Database status", "Sync queue status", "Webhook status"]}
      title="API Health"
    />
  );
}
