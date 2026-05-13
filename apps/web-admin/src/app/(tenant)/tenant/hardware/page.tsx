import { PagePlaceholder } from "@/components/app-shell";

export default function HardwarePage() {
  return (
    <PagePlaceholder
      description="Manage printers, scanners, cash drawers, and branch device bindings."
      items={["Printers", "Scanners", "Cash drawers", "Device status"]}
      title="Hardware"
    />
  );
}
