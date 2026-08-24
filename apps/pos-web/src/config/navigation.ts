import type { PosIconName } from "@/components/app-shell/icons";
import type { TranslationKey } from "@cleanhub/i18n";

import { posRoutes } from "./routes";

export type PosNavItem = {
  labelKey: TranslationKey;
  href: string;
  icon: PosIconName;
};

/**
 * POS navigation is intentionally flat. Cashiers work through a short,
 * task-oriented sequence and should not need to scan admin-style group
 * headings before finding the next operation.
 */
export const posSidebarNavigation: PosNavItem[] = [
  {
    labelKey: "pos.nav.workspace",
    href: posRoutes.workspace,
    icon: "home",
  },
  {
    labelKey: "pos.nav.sale",
    href: posRoutes.sale,
    icon: "shopping-cart",
  },
  {
    labelKey: "pos.nav.newIntake",
    href: posRoutes.newIntake,
    icon: "user-plus",
  },
  {
    labelKey: "pos.nav.scan",
    href: posRoutes.scan,
    icon: "scan-line",
  },
  {
    labelKey: "pos.nav.customers",
    href: posRoutes.customers,
    icon: "users",
  },
  {
    labelKey: "pos.nav.catalog",
    href: posRoutes.catalog,
    icon: "package-check",
  },
  {
    labelKey: "pos.nav.tickets",
    href: posRoutes.tickets,
    icon: "clipboard-list",
  },
  {
    labelKey: "pos.nav.orders",
    href: posRoutes.orders,
    icon: "receipt",
  },
  {
    labelKey: "pos.nav.statistics",
    href: posRoutes.statistics,
    icon: "chart",
  },
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
];

const POS_MOBILE_PRIMARY_HREFS = new Set<string>([
  posRoutes.workspace,
  posRoutes.sale,
  posRoutes.newIntake,
  posRoutes.tickets,
]);

export const posMobilePrimaryNavigation = posSidebarNavigation.filter((item) =>
  POS_MOBILE_PRIMARY_HREFS.has(item.href),
);

export const posMobileOverflowNavigation = posSidebarNavigation.filter(
  (item) => !POS_MOBILE_PRIMARY_HREFS.has(item.href),
);

export const posShellCopy = {
  brandName: "CleanHub",
  brandSuffixKey: "pos.app.brandSuffix",
} as const;
