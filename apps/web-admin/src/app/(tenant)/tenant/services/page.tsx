import { PagePlaceholder } from "@/components/app-shell";

export default function ServicesPage() {
  return (
    <PagePlaceholder
      description="Manage service catalog used by POS and branch operations."
      items={["Laundry services", "Dry cleaning", "Pressing", "Car wash"]}
      title="Services"
    />
  );
}
