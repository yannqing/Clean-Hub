"use client";

import type { LucideIcon, LucideProps } from "lucide-react"
import { forwardRef } from "react"

import { cn } from "@/lib/utils"

/**
 * Shared icon wrapper around a `lucide-react` icon component.
 *
 * Apps should prefer rendering icons through `<Icon icon={Users} />` rather
 * than importing `lucide-react` directly, so size / stroke / color stay
 * consistent and the lucide dependency stays behind `@cleanhub/ui` (keeping it
 * tree-shakeable and avoiding a second copy in app `package.json`s).
 *
 * The wrapper forwards all native `<svg>` props (className, aria-*, etc.), so
 * decorative icons should still be marked `aria-hidden` by the caller.
 */
export type IconProps = Omit<LucideProps, "ref"> & {
  /** The lucide icon component to render, e.g. `Users`, `LayoutDashboard`. */
  icon: LucideIcon
}

export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { icon: LucideComponent, className, size = 18, strokeWidth = 2, ...props },
  ref,
) {
  return (
    <LucideComponent
      ref={ref}
      className={cn("shrink-0", className)}
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden={props["aria-hidden"] ?? true}
      {...props}
    />
  )
})
