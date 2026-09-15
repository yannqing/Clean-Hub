import { PosFormPageSkeleton } from "@/components/app-shell";

/**
 * Settings renders outside the POS shell's padded content area, so the
 * skeleton has to supply its own gutters -- without them the placeholder sits
 * flush against the viewport edge for the length of the loading flash.
 */
export default function SettingsLoading() {
  return (
    <div className="px-5 py-6 lg:px-8">
      <PosFormPageSkeleton />
    </div>
  );
}
