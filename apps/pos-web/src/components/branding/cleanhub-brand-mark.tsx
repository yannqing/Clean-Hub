import { cn } from "@cleanhub/ui";
import Image from "next/image";

type CleanHubBrandMarkProps = {
  className?: string;
  priority?: boolean;
};

export function CleanHubBrandMark({
  className,
  priority = false,
}: CleanHubBrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-xl bg-white",
        className,
      )}
    >
      <Image
        alt=""
        className="object-cover"
        fill
        priority={priority}
        sizes="48px"
        src="/cleanhub-logo-mark.jpg"
        unoptimized
      />
    </span>
  );
}
