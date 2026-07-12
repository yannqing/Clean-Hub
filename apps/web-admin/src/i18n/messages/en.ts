import { webAdminRoutes } from "@/config/routes";

import { saasMessagesEn } from "./saas/en";
import { tenantMessagesEn } from "./tenant/en";
import type { SaasMessages } from "./saas";
import type { TenantMessages } from "./tenant";
import type { WebAdminMessages } from "../messages-types";

/**
 * English message bundle.
 *
 * This module is loaded eagerly (it is the default locale and the SSR/first-
 * paint fallback), so it lives in the main client chunk. Non-default locales
 * are loaded on demand from their own modules (e.g. `./zh-CN.ts`) so their
 * catalogs don't bloat the initial bundle.
 */
export const enMessages: WebAdminMessages = {
  shell: {
    saas: {
      eyebrow: "SaaS Admin",
      title: "Platform Operations",
      description:
        "Manage tenants, platform users, configuration, logs, and system controls.",
    },
    tenant: {
      eyebrow: "Tenant Admin",
      title: "Store Operations",
      description:
        "Manage branches, staff, service configuration, reports, and tenant settings.",
    },
  },
  sidebar: {
    saas: [
      {
        title: "Main",
        items: [
          { label: "Dashboard", href: webAdminRoutes.saas.home },
          { label: "My Todo", href: webAdminRoutes.saas.todos },
          { label: "User Management", href: webAdminRoutes.saas.users },
          {
            label: "Feedback Tickets",
            href: webAdminRoutes.saas.feedbackTickets,
          },
        ],
      },
      {
        title: "Configuration Management",
        items: [
          {
            label: "Tenant Management",
            href: webAdminRoutes.saas.config.tenants,
          },
          {
            label: "Feature Flags",
            href: webAdminRoutes.saas.config.featureFlags,
          },
          {
            label: "Localization",
            href: webAdminRoutes.saas.config.localization,
          },
          {
            label: "Platform Settings",
            href: webAdminRoutes.saas.config.platformSettings,
          },
        ],
      },
      {
        title: "System Settings",
        items: [
          { label: "Audit Logs", href: webAdminRoutes.saas.auditLogs },
          { label: "Operation Logs", href: webAdminRoutes.saas.system.logs },
          { label: "Data Backups", href: webAdminRoutes.saas.system.backups },
          {
            label: "Security Settings",
            href: webAdminRoutes.saas.system.security,
          },
        ],
      },
    ],
    tenant: [
      {
        title: "Main",
        items: [
          { label: "Dashboard", href: webAdminRoutes.tenant.home },
          { label: "User Management", href: webAdminRoutes.tenant.users },
          { label: "Reports", href: webAdminRoutes.tenant.reports },
        ],
      },
      {
        title: "Configuration Management",
        items: [
          {
            label: "Branch Settings",
            href: webAdminRoutes.tenant.config.branches,
          },
          {
            label: "Service Catalog",
            href: webAdminRoutes.tenant.config.services,
          },
          { label: "Price Books", href: webAdminRoutes.tenant.config.prices },
          {
            label: "Hardware Devices",
            href: webAdminRoutes.tenant.config.hardware,
          },
          {
            label: "Notifications",
            href: webAdminRoutes.tenant.config.notifications,
          },
        ],
      },
      {
        title: "System Settings",
        items: [
          { label: "Operation Logs", href: webAdminRoutes.tenant.system.logs },
          { label: "Data Backups", href: webAdminRoutes.tenant.system.backups },
          {
            label: "Tenant Settings",
            href: webAdminRoutes.tenant.system.settings,
          },
        ],
      },
    ],
  },
  common: {
    personalCenter: "Personal Center",
    language: "Language",
    signOut: "Sign out",
    signingOut: "Signing out...",
  },
  saas: saasMessagesEn satisfies SaasMessages,
  tenant: tenantMessagesEn satisfies TenantMessages,
};
