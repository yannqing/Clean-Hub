import {
  Building2,
  ClipboardList,
  DatabaseBackup,
  Flag,
  Globe,
  LayoutDashboard,
  ListChecks,
  MessageSquareWarning,
  ScrollText,
  Settings,
  ShieldCheck,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";

import { webAdminRoutes } from "./routes";

/**
 * Sidebar nav icon mapping.
 *
 * Icons are keyed by route href (not by i18n label) on purpose: an icon is a
 * visual affordance for a destination, not localized copy, so it belongs here
 * next to the route config rather than inside `WebAdminMessages`. Items without
 * a mapping render text-only, so adding icons is strictly incremental.
 *
 * Kept as a plain `Record` so the sidebar lookup is O(1) and tree-shakeable.
 */
const navIconByHref: Record<string, LucideIcon> = {
  // SaaS
  [webAdminRoutes.saas.home]: LayoutDashboard,
  [webAdminRoutes.saas.todos]: ListChecks,
  [webAdminRoutes.saas.users]: Users,
  [webAdminRoutes.saas.feedbackTickets]: MessageSquareWarning,
  [webAdminRoutes.saas.config.tenants]: Building2,
  [webAdminRoutes.saas.config.featureFlags]: Flag,
  [webAdminRoutes.saas.config.localization]: Globe,
  [webAdminRoutes.saas.config.platformSettings]: Settings,
  [webAdminRoutes.saas.auditLogs]: ScrollText,
  [webAdminRoutes.saas.system.logs]: ScrollText,
  [webAdminRoutes.saas.system.backups]: DatabaseBackup,
  [webAdminRoutes.saas.system.security]: ShieldCheck,

  // Tenant
  [webAdminRoutes.tenant.home]: LayoutDashboard,
  [webAdminRoutes.tenant.users]: Users,
  [webAdminRoutes.tenant.reports]: ClipboardList,
  [webAdminRoutes.tenant.config.branches]: Store,
  [webAdminRoutes.tenant.config.services]: ClipboardList,
  [webAdminRoutes.tenant.config.prices]: Flag,
  [webAdminRoutes.tenant.config.hardware]: ShieldCheck,
  [webAdminRoutes.tenant.config.notifications]: MessageSquareWarning,
  [webAdminRoutes.tenant.system.logs]: ScrollText,
  [webAdminRoutes.tenant.system.backups]: DatabaseBackup,
  [webAdminRoutes.tenant.system.settings]: Settings,
};

/** Returns the icon for a nav href, or `undefined` if none is mapped. */
export function getNavIcon(href: string): LucideIcon | undefined {
  return navIconByHref[href];
}
