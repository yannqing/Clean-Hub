import type { PosIconName } from "@/components/app-shell/icons";
import type { TranslationKey } from "@cleanhub/i18n";

import { posRoutes } from "./routes";

export type PosNavItem = {
  labelKey: TranslationKey;
  href: string;
  icon: PosIconName;
};

export type PosNavSection = {
  titleKey: TranslationKey;
  items: PosNavItem[];
};

export const posSidebarNavigation: PosNavSection[] = [
  {
    titleKey: "pos.nav.operations",
    items: [
      {
        labelKey: "pos.nav.workspace",
        href: posRoutes.workspace,
        icon: "layout-dashboard",
      },
      {
        labelKey: "pos.nav.newIntake",
        href: posRoutes.newIntake,
        icon: "user-plus",
      },
      { labelKey: "pos.nav.scan", href: posRoutes.scan, icon: "scan-line" },
    ],
  },
  {
    titleKey: "pos.nav.records",
    items: [
      {
        labelKey: "pos.nav.customers",
        href: posRoutes.customers,
        icon: "users",
      },
      {
        labelKey: "pos.nav.tickets",
        href: posRoutes.tickets,
        icon: "clipboard-list",
      },
      { labelKey: "pos.nav.orders", href: posRoutes.orders, icon: "receipt" },
      {
        labelKey: "pos.nav.statistics",
        href: posRoutes.statistics,
        icon: "chart",
      },
      { labelKey: "pos.nav.garments", href: posRoutes.garments, icon: "shirt" },
    ],
  },
  {
    titleKey: "pos.nav.store",
    items: [
      {
        labelKey: "pos.nav.shiftHandover",
        href: posRoutes.shiftHandover,
        icon: "replace",
      },
      {
        labelKey: "pos.nav.notifications",
        href: posRoutes.notifications,
        icon: "bell",
      },
      {
        labelKey: "pos.nav.settings",
        href: posRoutes.settings,
        icon: "settings",
      },
    ],
  },
];

export const posShellCopy = {
  brandName: "CleanHub",
  brandSuffixKey: "pos.app.brandSuffix",
} as const;
