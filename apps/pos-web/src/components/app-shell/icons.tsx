import type { SVGProps } from "react";

import { cn } from "@cleanhub/ui";

/**
 * Inline icon set mirrored from the POS design prototype
 * (docs/03-design/prototypes/pos). Paths match the lucide glyphs the
 * prototype used, kept inline so the POS app needs no extra icon dependency.
 */
const POS_ICON_PATHS = {
  check: '<path d="m20 6-11 11-5-5"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  chart:
    '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="5" rx="1"/><rect x="12" y="8" width="3" height="9" rx="1"/><rect x="17" y="5" width="3" height="12" rx="1"/>',
  "chevron-right": '<path d="m9 18 6-6-6-6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  "clipboard-list":
    '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M8 11h8"/><path d="M8 16h5"/>',
  languages:
    '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  "layout-dashboard":
    '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  lock: '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  "key-round":
    '<path d="m21 2-2 2"/><circle cx="8.5" cy="15.5" r="5.5"/><path d="M12.5 11.5 17 7"/><path d="m15 6 3 3"/><path d="m18 3 3 3"/>',
  "log-out":
    '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  ellipsis:
    '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  monitor:
    '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  "map-pin":
    '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z"/>',
  receipt:
    '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2Z"/><path d="M8 7h8"/><path d="M8 12h8"/><path d="M8 17h5"/>',
  replace:
    '<path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M10 20H4v-6"/><path d="M4 20l10-10"/>',
  "scan-line":
    '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  "shield-check":
    '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z"/><path d="m9 12 2 2 4-4"/>',
  settings:
    '<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8.9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.17.52.66 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.85 0-1.34.48-1.51 1Z"/>',
  shirt:
    '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.23 2.18l.62 3.1a2 2 0 0 0 2.74 1.42L6 10v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V10l.25.16a2 2 0 0 0 2.74-1.42l.62-3.1a2 2 0 0 0-1.23-2.18Z"/>',
  store:
    '<path d="M3 9l1.5-6h15L21 9"/><path d="M5 13v8h14v-8"/><path d="M9 21v-6h6v6"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>',
  home:
    '<path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10"/><path d="M9 21v-6h6v6"/>',
  "user-circle":
    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="9" r="3"/><path d="M6.2 18.5a6.5 6.5 0 0 1 11.6 0"/>',
  "user-plus":
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  "wallet-cards":
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M7 15h2"/>',
  // Ticket-management glyphs (mirrored from the POS tickets prototype).
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  "square-pen":
    '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
  printer:
    '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  trash:
    '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  "rotate-ccw": '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  "arrow-left": '<path d="m15 18-6-6 6-6"/><path d="M9 12h12"/>',
  "chevron-down": '<path d="m6 9 6 6 6-6"/>',
  "chevron-up": '<path d="m18 15-6-6-6 6"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  alert:
    '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  "package-check":
    '<path d="m16 16 2 2 4-4"/><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  "search-x":
    '<path d="M13 4a9 9 0 1 1-9 9"/><path d="m16 16 6 6"/><path d="m21 21-6-6"/>',
} as const;

export type PosIconName = keyof typeof POS_ICON_PATHS;

type IconProps = SVGProps<SVGSVGElement> & {
  name: PosIconName;
};

export function Icon({ name, className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={cn("h-4 w-4", className)}
      dangerouslySetInnerHTML={{ __html: POS_ICON_PATHS[name] }}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    />
  );
}
