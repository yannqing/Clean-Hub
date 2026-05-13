import { PagePlaceholder } from "@/components/app-shell";

export default function SaasFeatureFlagsPage() {
  return (
    <PagePlaceholder
      description="Platform feature switches used to control tenant rollout, experiments, and module visibility."
      items={["Tenant rollout", "Module switches", "Experiments", "Release notes"]}
      title="Feature Flags"
    />
  );
}
